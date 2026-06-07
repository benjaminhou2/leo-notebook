import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  audit,
  cleanFileName,
  createId,
  decodeDataUrl,
  getPool,
  hashBuffer,
  hashText,
  knowledgeRow,
  loadAuthConfig,
  materialRow,
  parseBody,
  projectRoot,
  promptVariables,
  safeJson,
  sendJson,
  siteRoot,
  subjectDirectory,
  subjectLabel
} from './core.mjs';
import { retryAiRun, runAiTask } from './ai-runtime.mjs';
import { reviewQuestions, semanticHash } from './quiz-quality.mjs';

const execFileAsync = promisify(execFile);

function routeMatch(pathname, pattern) {
  const pathParts = pathname.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;
  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index];
    const actual = decodeURIComponent(pathParts[index]);
    if (expected.startsWith(':')) params[expected.slice(1)] = actual;
    else if (expected !== actual) return null;
  }
  return params;
}

async function imageMetadata(filePath, size) {
  try {
    const { stdout } = await execFileAsync('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', filePath]);
    const width = Number(stdout.match(/pixelWidth:\s*(\d+)/)?.[1] || 0);
    const height = Number(stdout.match(/pixelHeight:\s*(\d+)/)?.[1] || 0);
    const pixels = width * height;
    const dimensionScore = Math.min(100, (Math.min(width, height) / 1200) * 100);
    const densityScore = Math.min(100, (size / Math.max(pixels, 1)) * 20000);
    return {
      width,
      height,
      clarityScore: Number((dimensionScore * 0.8 + densityScore * 0.2).toFixed(2))
    };
  } catch {
    return { width: 0, height: 0, clarityScore: 0 };
  }
}

async function writeFileToBoth(relativeSource, buffer) {
  const sourcePath = path.join(projectRoot, relativeSource);
  const publicPath = path.join(siteRoot, 'public/materials', relativeSource);
  await fs.mkdir(path.dirname(sourcePath), { recursive: true });
  await fs.mkdir(path.dirname(publicPath), { recursive: true });
  await Promise.all([fs.writeFile(sourcePath, buffer), fs.writeFile(publicPath, buffer)]);
  return { sourcePath, publicPath };
}

async function renderPdfPages(pdfPath, outputDirectory) {
  await fs.mkdir(outputDirectory, { recursive: true });
  const scriptPath = path.join(siteRoot, 'scripts/pdf-to-images.swift');
  const { stdout } = await execFileAsync('/usr/bin/swift', [scriptPath, pdfPath, outputDirectory], {
    timeout: 120000,
    maxBuffer: 1024 * 1024
  });
  const pageCount = Number(String(stdout).trim().split('\n').at(-1) || 0);
  const names = (await fs.readdir(outputDirectory))
    .filter((name) => name.endsWith('.png'))
    .sort();
  return { pageCount, names };
}

async function saveUploadedFiles(pool, material, uploadedFiles) {
  const rawFiles = [];
  const pages = [];
  const baseDirectory = subjectDirectory(material.subject);
  const cleanTitle = cleanFileName(material.title);
  let pageNumber = 1;

  for (let fileIndex = 0; fileIndex < uploadedFiles.length; fileIndex += 1) {
    const file = uploadedFiles[fileIndex];
    const { mimeType, buffer } = decodeDataUrl(file.base64);
    const sourceHash = hashBuffer(buffer);
    const [[duplicate]] = await pool.query(
      'SELECT id, source FROM material_pages WHERE source_hash = ? ORDER BY id LIMIT 1',
      [sourceHash]
    );
    const extension = path.extname(file.name).replace('.', '').toLowerCase()
      || (mimeType === 'application/pdf' ? 'pdf' : 'jpg');
    const storedName = `${material.date}-${cleanTitle}-原始文件${fileIndex + 1}.${extension}`;
    const relativeSource = `${baseDirectory}${storedName}`;
    const { sourcePath } = await writeFileToBoth(relativeSource, buffer);

    rawFiles.push({
      label: file.name || `原始文件 ${fileIndex + 1}`,
      source: relativeSource,
      mimeType,
      hash: sourceHash,
      duplicate: Boolean(duplicate)
    });

    if (mimeType === 'application/pdf' || extension === 'pdf') {
      const renderedDirectory = path.join(path.dirname(sourcePath), `${path.basename(storedName, '.pdf')}-分页`);
      const rendered = await renderPdfPages(sourcePath, renderedDirectory);
      for (const pageName of rendered.names) {
        const pageBuffer = await fs.readFile(path.join(renderedDirectory, pageName));
        const pageFileName = `${material.date}-${cleanTitle}-第${pageNumber}页-分析图.png`;
        const pageRelativeSource = `${baseDirectory}${pageFileName}`;
        const { sourcePath: pageSourcePath } = await writeFileToBoth(pageRelativeSource, pageBuffer);
        const metadata = await imageMetadata(pageSourcePath, pageBuffer.length);
        pages.push({
          pageNumber,
          source: pageRelativeSource,
          fileType: 'image/png',
          sourceHash: hashBuffer(pageBuffer),
          clarityScore: metadata.clarityScore,
          duplicateOf: duplicate?.id || null,
          reviewRequired: metadata.clarityScore < 45
        });
        pageNumber += 1;
      }
    } else {
      const metadata = await imageMetadata(sourcePath, buffer.length);
      pages.push({
        pageNumber,
        source: relativeSource,
        fileType: mimeType,
        sourceHash,
        clarityScore: metadata.clarityScore,
        duplicateOf: duplicate?.id || null,
        reviewRequired: metadata.clarityScore < 45
      });
      pageNumber += 1;
    }
  }

  for (const page of pages) {
    await pool.query(
      `INSERT INTO material_pages
        (material_id, page_number, source, file_type, source_hash, clarity_score, rotation, duplicate_of, review_required)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        material.id,
        page.pageNumber,
        page.source,
        page.fileType,
        page.sourceHash,
        page.clarityScore,
        page.duplicateOf,
        page.reviewRequired ? 1 : 0
      ]
    );
  }

  return { rawFiles, pages };
}

async function pageDataUrls(pool, materialId) {
  const [pages] = await pool.query(
    'SELECT page_number, source, file_type FROM material_pages WHERE material_id = ? ORDER BY page_number',
    [materialId]
  );
  const files = [];
  for (const page of pages) {
    if (!String(page.file_type).startsWith('image/')) continue;
    const absolutePath = path.join(projectRoot, page.source);
    const buffer = await fs.readFile(absolutePath);
    files.push({
      name: path.basename(page.source),
      type: page.file_type,
      size: buffer.length,
      base64: `data:${page.file_type};base64,${buffer.toString('base64')}`
    });
  }
  return files;
}

async function findMaterial(pool, materialId) {
  const [[row]] = await pool.query('SELECT * FROM materials WHERE id = ?', [materialId]);
  if (!row) throw new Error('找不到这份学习素材。');
  return row;
}

async function analyzeMaterial(pool, materialId) {
  const material = await findMaterial(pool, materialId);
  const profile = (await pool.query("SELECT * FROM student_profiles WHERE id = 'leo'"))[0][0];
  const files = await pageDataUrls(pool, materialId);

  await pool.query(
    `UPDATE materials SET analysis_status = 'running', status = 'analyzing', processing_error = NULL WHERE id = ?`,
    [materialId]
  );

  try {
    const structureRun = await runAiTask({
      pool,
      taskType: 'material-structure',
      subject: material.subject,
      materialType: material.type,
      materialId,
      files,
      variables: {
        subject: material.subject,
        grade: material.grade || profile.grade,
        semester: material.semester || profile.semester,
        materialType: material.type,
        materialTitle: material.title,
        fileCount: files.length,
        hasAnswers: Boolean(material.has_answers),
        hasTeacherMarks: Boolean(material.has_teacher_marks)
      }
    });
    const structured = structureRun.output;

    await pool.query('DELETE FROM material_questions WHERE material_id = ?', [materialId]);
    const questionIdByNumber = new Map();
    for (const [index, question] of (structured.questions || []).entries()) {
      const number = String(question.number || index + 1);
      const [insertResult] = await pool.query(
        `INSERT INTO material_questions
          (material_id, page_number, question_number, question_type, score, prompt, student_answer,
           correct_answer, teacher_mark, evidence_text, confidence, review_required, review_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          materialId,
          Number(question.page || 1),
          number,
          question.type || '',
          question.score ?? null,
          question.prompt || '',
          question.studentAnswer || '',
          question.correctAnswer || '',
          question.teacherMark || '',
          question.evidenceText || '',
          Number(question.confidence || 0) * (Number(question.confidence || 0) <= 1 ? 100 : 1),
          question.reviewRequired ? 1 : 0
        ]
      );
      questionIdByNumber.set(number, insertResult.insertId);
    }

    const analysisRun = await runAiTask({
      pool,
      taskType: 'material-analysis',
      subject: material.subject,
      materialType: material.type,
      materialId,
      variables: {
        subject: material.subject,
        grade: material.grade || profile.grade,
        semester: material.semester || profile.semester,
        materialType: material.type,
        materialTitle: material.title,
        structuredQuestions: structured.questions || [],
        existingSummary: material.summary || ''
      }
    });
    const analysis = analysisRun.output;

    await pool.query('DELETE FROM material_findings WHERE material_id = ?', [materialId]);
    for (const finding of analysis.findings || []) {
      const confidence = Number(finding.confidence || 0) * (Number(finding.confidence || 0) <= 1 ? 100 : 1);
      await pool.query(
        `INSERT INTO material_findings
          (material_id, question_id, title, category, priority, reason, knowledge_code,
           evidence_text, student_answer, expected_answer, confidence, review_required, review_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          materialId,
          questionIdByNumber.get(String(finding.questionNumber || '')) || null,
          finding.title || '待确认薄弱点',
          finding.category || 'skill',
          ['P0', 'P1', 'P2'].includes(finding.priority) ? finding.priority : 'P1',
          finding.reason || '',
          finding.knowledgeCode || '',
          finding.evidenceText || '',
          finding.studentAnswer || '',
          finding.expectedAnswer || '',
          confidence,
          finding.reviewRequired || confidence < 60 ? 1 : 0
        ]
      );
    }

    const confidenceValues = [
      Number(structured.confidence || 0) * (Number(structured.confidence || 0) <= 1 ? 100 : 1),
      ...(analysis.findings || []).map((item) =>
        Number(item.confidence || 0) * (Number(item.confidence || 0) <= 1 ? 100 : 1)
      )
    ].filter(Number.isFinite);
    const confidence = confidenceValues.length
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : 0;

    await pool.query(
      `UPDATE materials SET
        title = COALESCE(NULLIF(?, ''), title),
        summary = COALESCE(NULLIF(?, ''), summary),
        analysis_summary = ?,
        analysis_strengths = ?,
        analysis_needs_improvement = ?,
        analysis_status = 'completed',
        status = 'pending_review',
        analysis_confidence = ?,
        skill_slug = ?,
        skill_version = ?,
        prompt_slug = ?,
        prompt_version = ?,
        model_key = ?,
        ai_run_id = ?,
        processing_error = NULL
       WHERE id = ?`,
      [
        structured.title || '',
        structured.summary || '',
        analysis.summary || '',
        JSON.stringify(analysis.strengths || []),
        JSON.stringify((analysis.findings || []).map((finding) => finding.title).filter(Boolean)),
        confidence,
        analysisRun.provenance.skillSlug,
        analysisRun.provenance.skillVersion,
        analysisRun.provenance.promptSlug,
        analysisRun.provenance.promptVersion,
        analysisRun.provenance.modelKey,
        analysisRun.runId,
        materialId
      ]
    );
    await audit(pool, 'material', materialId, 'analysis_completed', {
      structureRunId: structureRun.runId,
      analysisRunId: analysisRun.runId
    });
    return { structureRunId: structureRun.runId, analysisRunId: analysisRun.runId };
  } catch (error) {
    await pool.query(
      `UPDATE materials
       SET analysis_status = 'failed', status = 'analysis_failed', processing_error = ?
       WHERE id = ?`,
      [error.message, materialId]
    );
    throw error;
  }
}

function pointIdForFinding(finding) {
  const source = finding.knowledge_code || finding.title;
  return `kp-${hashText(source).slice(0, 32)}`;
}

function masteryStatus(score, occurrenceCount = 1) {
  if (score >= 85 && occurrenceCount >= 2) return 'mastered';
  if (score >= 65) return 'improving';
  if (occurrenceCount >= 2) return 'persistent';
  return 'new';
}

async function confirmMaterial(pool, materialId, body) {
  const material = await findMaterial(pool, materialId);
  const acceptedFindingIds = new Set((body.acceptedFindingIds || []).map(Number));
  const rejectedFindingIds = new Set((body.rejectedFindingIds || []).map(Number));
  const reviewRequiredFindingIds = new Set((body.reviewRequiredFindingIds || []).map(Number));

  const [findings] = await pool.query('SELECT * FROM material_findings WHERE material_id = ?', [materialId]);
  for (const finding of findings) {
    let reviewStatus = 'pending';
    if (acceptedFindingIds.has(finding.id)) reviewStatus = 'accepted';
    if (rejectedFindingIds.has(finding.id)) reviewStatus = 'rejected';
    if (reviewRequiredFindingIds.has(finding.id)) reviewStatus = 'needs_review';
    await pool.query(
      `UPDATE material_findings
       SET review_status = ?, review_required = ?, reviewer_note = ?
       WHERE id = ?`,
      [reviewStatus, reviewStatus === 'needs_review' ? 1 : finding.review_required, body.reviewerNote || '', finding.id]
    );

    if (reviewStatus !== 'accepted') continue;
    const pointId = pointIdForFinding(finding);
    const [[existing]] = await pool.query('SELECT * FROM knowledge_points WHERE id = ?', [pointId]);
    const evidenceIds = existing ? safeJson(existing.evidence_material_ids, []) : [];
    if (!evidenceIds.includes(materialId)) evidenceIds.push(materialId);
    const occurrenceCount = existing ? Number(existing.occurrence_count || 0) + 1 : 1;
    const masteryScore = existing ? Number(existing.mastery_score || 0) : 25;
    const status = masteryStatus(masteryScore, occurrenceCount);

    await pool.query(
      `INSERT INTO knowledge_points
        (id, subject, priority, title, reason, goal, checkpoints, practice_files, evidence_material_ids,
         catalog_code, status, mastery_score, confidence_score, occurrence_count, next_review_at,
         last_evidence_at, grade, semester, textbook_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        priority = VALUES(priority), reason = VALUES(reason), evidence_material_ids = VALUES(evidence_material_ids),
        catalog_code = COALESCE(NULLIF(VALUES(catalog_code), ''), catalog_code),
        status = VALUES(status), occurrence_count = VALUES(occurrence_count),
        last_evidence_at = NOW(), next_review_at = NOW(), confidence_score = VALUES(confidence_score)`,
      [
        pointId,
        material.subject,
        finding.priority,
        finding.title,
        finding.reason,
        `针对“${finding.title}”完成第一轮诊断、第二轮强化和一次间隔复习。`,
        JSON.stringify(['能说清关键规则', '第一轮达到 80 分', '第二轮达到 85 分']),
        JSON.stringify(evidenceIds),
        finding.knowledge_code || '',
        status,
        masteryScore,
        finding.confidence,
        occurrenceCount,
        material.grade,
        material.semester,
        material.textbook_version
      ]
    );

    const taskId = `diagnose-${pointId}`;
    await pool.query(
      `INSERT INTO study_tasks
        (id, subject, point_id, material_id, title, reason, task_type, status, priority,
         estimated_minutes, mastery_goal, due_at)
       VALUES (?, ?, ?, ?, ?, ?, 'round1', 'pending', ?, 10, ?, NOW())
       ON DUPLICATE KEY UPDATE
        reason = VALUES(reason), priority = VALUES(priority), status = 'pending', due_at = NOW()`,
      [
        taskId,
        material.subject,
        pointId,
        materialId,
        `第一轮诊断：${finding.title}`,
        finding.reason,
        finding.priority,
        '第一轮达到 80 分并看懂错题解析'
      ]
    );
    await pool.query(
      `INSERT INTO mastery_snapshots
        (point_id, mastery_score, confidence_score, status, reason, source_type, source_id)
       VALUES (?, ?, ?, ?, ?, 'material', ?)`,
      [pointId, masteryScore, finding.confidence, status, finding.reason, materialId]
    );
  }

  await pool.query(
    `UPDATE materials
     SET status = 'confirmed', analysis_status = 'confirmed', processing_error = NULL
     WHERE id = ?`,
    [materialId]
  );
  await audit(pool, 'material', materialId, 'review_confirmed', {
    accepted: [...acceptedFindingIds],
    rejected: [...rejectedFindingIds],
    needsReview: [...reviewRequiredFindingIds]
  });
}

async function getDashboard(pool) {
  const [
    [materialStats],
    [taskStats],
    [knowledgeStats],
    [recentMaterials],
    [priorityPoints],
    [todayTasks],
    [recentResults],
    [reviewItems]
  ] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) total,
        SUM(status = 'pending_review') pending_review,
        SUM(analysis_status = 'failed') failed,
        SUM(status = 'confirmed') confirmed
      FROM materials WHERE archived_at IS NULL
    `),
    pool.query(`
      SELECT COUNT(*) total, SUM(status = 'pending') pending, SUM(status = 'completed') completed
      FROM study_tasks
    `),
    pool.query(`
      SELECT COUNT(*) total,
        SUM(priority = 'P0') p0,
        SUM(status = 'mastered') mastered,
        AVG(mastery_score) average_mastery
      FROM knowledge_points
    `),
    pool.query(`
      SELECT id, subject, date, type, title, priority, status, analysis_status, analysis_confidence, processing_error
      FROM materials WHERE archived_at IS NULL
      ORDER BY updated_at DESC LIMIT 8
    `),
    pool.query(`
      SELECT kp.*,
        (SELECT COUNT(*) FROM material_findings mf
         WHERE mf.knowledge_code = kp.catalog_code AND mf.review_status = 'accepted') evidence_count
      FROM knowledge_points kp
      ORDER BY FIELD(priority, 'P0', 'P1', 'P2'), mastery_score ASC, updated_at DESC LIMIT 8
    `),
    pool.query(`
      SELECT st.*,
        EXISTS (
          SELECT 1 FROM quiz_questions qq
          WHERE qq.point_id = st.point_id
            AND qq.status = 'published'
            AND (
              (st.task_type = 'round2' AND qq.round = 2)
              OR (st.task_type IN ('round1', 'review') AND qq.round = 1)
            )
        ) actionable
      FROM study_tasks st
      WHERE status IN ('pending', 'in_progress')
      ORDER BY (due_at IS NULL), due_at ASC, FIELD(priority, 'P0', 'P1', 'P2'), sort_order ASC
      LIMIT 8
    `),
    pool.query(`
      SELECT * FROM quiz_results ORDER BY completed_at DESC LIMIT 12
    `),
    pool.query(`
      SELECT 'finding' item_type, mf.id, mf.material_id, mf.title, mf.confidence, mf.evidence_text,
        m.subject, m.title material_title
      FROM material_findings mf
      JOIN materials m ON m.id = mf.material_id
      WHERE mf.review_required = 1 AND mf.review_status IN ('pending', 'needs_review')
      UNION ALL
      SELECT 'question' item_type, mq.id, mq.material_id, CONCAT('第', mq.question_number, '题') title,
        mq.confidence, mq.evidence_text, m.subject, m.title material_title
      FROM material_questions mq
      JOIN materials m ON m.id = mq.material_id
      WHERE mq.review_required = 1 AND mq.review_status = 'pending'
      LIMIT 8
    `)
  ]);

  const trendRows = await pool.query(`
    SELECT DATE(completed_at) day, AVG(score) score, COUNT(*) count
    FROM quiz_results
    WHERE completed_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY DATE(completed_at)
    ORDER BY day
  `);

  return {
    stats: {
      materials: materialStats[0] || {},
      tasks: taskStats[0] || {},
      knowledge: knowledgeStats[0] || {}
    },
    recentMaterials,
    priorityPoints,
    todayTasks,
    recentResults: recentResults.map((row) => ({
      id: row.id,
      subject: row.subject,
      pointId: row.point_id,
      pointTitle: row.point_title,
      round: row.round,
      score: row.score,
      completedAt: row.completed_at,
      wrongTags: safeJson(row.wrong_tags, [])
    })),
    reviewItems,
    trend: trendRows[0]
  };
}

async function getMaterials(pool, searchParams) {
  const filters = ['archived_at IS NULL'];
  const params = [];
  for (const [column, key] of [
    ['subject', 'subject'],
    ['status', 'status'],
    ['analysis_status', 'analysisStatus']
  ]) {
    const value = searchParams.get(key);
    if (value && value !== 'all') {
      filters.push(`${column} = ?`);
      params.push(value);
    }
  }
  const query = searchParams.get('q');
  if (query) {
    filters.push('(title LIKE ? OR summary LIKE ?)');
    params.push(`%${query}%`, `%${query}%`);
  }
  const [rows] = await pool.query(
    `SELECT * FROM materials WHERE ${filters.join(' AND ')} ORDER BY date DESC, updated_at DESC`,
    params
  );
  return rows.map(materialRow);
}

async function getMaterialDetail(pool, materialId) {
  const material = materialRow(await findMaterial(pool, materialId));
  const [[pages], [questions], [findings], [runs]] = await Promise.all([
    pool.query('SELECT * FROM material_pages WHERE material_id = ? ORDER BY page_number', [materialId]),
    pool.query('SELECT * FROM material_questions WHERE material_id = ? ORDER BY page_number, id', [materialId]),
    pool.query('SELECT * FROM material_findings WHERE material_id = ? ORDER BY FIELD(priority, "P0", "P1", "P2"), id', [materialId]),
    pool.query('SELECT * FROM ai_runs WHERE material_id = ? ORDER BY created_at DESC', [materialId])
  ]);
  return {
    ...material,
    pages: pages.map((page) => ({
      id: page.id,
      pageNumber: page.page_number,
      source: page.source,
      fileType: page.file_type,
      clarityScore: Number(page.clarity_score || 0),
      rotation: page.rotation,
      duplicateOf: page.duplicate_of,
      reviewRequired: Boolean(page.review_required)
    })),
    questions: questions.map((question) => ({
      id: question.id,
      pageNumber: question.page_number,
      number: question.question_number,
      type: question.question_type,
      score: question.score,
      prompt: question.prompt,
      studentAnswer: question.student_answer,
      correctAnswer: question.correct_answer,
      teacherMark: question.teacher_mark,
      evidenceText: question.evidence_text,
      confidence: Number(question.confidence || 0),
      reviewRequired: Boolean(question.review_required),
      reviewStatus: question.review_status
    })),
    findings: findings.map((finding) => ({
      id: finding.id,
      questionId: finding.question_id,
      title: finding.title,
      category: finding.category,
      priority: finding.priority,
      reason: finding.reason,
      knowledgeCode: finding.knowledge_code || '',
      evidenceText: finding.evidence_text || '',
      studentAnswer: finding.student_answer || '',
      expectedAnswer: finding.expected_answer || '',
      confidence: Number(finding.confidence || 0),
      reviewRequired: Boolean(finding.review_required),
      reviewStatus: finding.review_status,
      reviewerNote: finding.reviewer_note || ''
    })),
    runs: runs.map((run) => ({
      id: run.id,
      taskType: run.task_type,
      skillSlug: run.skill_slug,
      skillVersion: run.skill_version,
      promptSlug: run.prompt_slug,
      promptVersion: run.prompt_version,
      modelKey: run.model_key,
      status: run.status,
      durationMs: run.duration_ms,
      errorMessage: run.error_message,
      createdAt: run.created_at
    }))
  };
}

async function getKnowledgePoints(pool, searchParams) {
  const filters = ['1=1'];
  const params = [];
  const subject = searchParams.get('subject');
  const status = searchParams.get('status');
  if (subject && subject !== 'all') {
    filters.push('kp.subject = ?');
    params.push(subject);
  }
  if (status && status !== 'all') {
    filters.push('kp.status = ?');
    params.push(status);
  }
  const [rows] = await pool.query(
    `SELECT kp.*, qr.score latest_score, qr.round latest_round, qr.completed_at latest_completed_at
     FROM knowledge_points kp
     LEFT JOIN quiz_results qr ON qr.id = (
       SELECT id FROM quiz_results WHERE point_id = kp.id ORDER BY completed_at DESC LIMIT 1
     )
     WHERE ${filters.join(' AND ')}
     ORDER BY FIELD(kp.priority, 'P0', 'P1', 'P2'), kp.mastery_score ASC`,
    params
  );
  return rows.map(knowledgeRow);
}

async function getKnowledgeTimeline(pool, pointId) {
  const [[point], [snapshots], [findings], [results], [tasks]] = await Promise.all([
    pool.query('SELECT * FROM knowledge_points WHERE id = ?', [pointId]),
    pool.query('SELECT * FROM mastery_snapshots WHERE point_id = ? ORDER BY created_at DESC', [pointId]),
    pool.query(
      `SELECT mf.*, m.title material_title, m.date material_date
       FROM material_findings mf
       JOIN materials m ON m.id = mf.material_id
       WHERE mf.review_status = 'accepted'
         AND (mf.knowledge_code = (SELECT catalog_code FROM knowledge_points WHERE id = ?)
              OR mf.title = (SELECT title FROM knowledge_points WHERE id = ?))
       ORDER BY mf.created_at DESC`,
      [pointId, pointId]
    ),
    pool.query('SELECT * FROM quiz_results WHERE point_id = ? ORDER BY completed_at DESC', [pointId]),
    pool.query('SELECT * FROM study_tasks WHERE point_id = ? ORDER BY created_at DESC', [pointId])
  ]);
  if (!point.length) throw new Error('找不到这个知识点。');
  return { point: knowledgeRow(point[0]), snapshots, findings, results, tasks };
}

async function getToday(pool) {
  const [tasks] = await pool.query(
    `SELECT st.*, kp.mastery_score, kp.status point_status
     FROM study_tasks st
     LEFT JOIN knowledge_points kp ON kp.id = st.point_id
     WHERE st.status IN ('pending', 'in_progress')
       AND EXISTS (
         SELECT 1 FROM quiz_questions qq
         WHERE qq.point_id = st.point_id
           AND qq.status = 'published'
           AND (
             (st.task_type = 'round2' AND qq.round = 2)
             OR (st.task_type IN ('round1', 'review') AND qq.round = 1)
           )
       )
     ORDER BY
       CASE WHEN st.status = 'in_progress' THEN 0 ELSE 1 END,
       CASE WHEN st.due_at <= NOW() THEN 0 ELSE 1 END,
       FIELD(st.priority, 'P0', 'P1', 'P2'),
       st.due_at
     LIMIT 3`
  );
  const [[progress]] = await pool.query(
    `SELECT
       SUM(st.status = 'completed' AND DATE(st.completed_at) = CURDATE()) completed_today,
       SUM(st.status IN ('pending', 'in_progress') AND EXISTS (
         SELECT 1 FROM quiz_questions qq
         WHERE qq.point_id = st.point_id
           AND qq.status = 'published'
           AND (
             (st.task_type = 'round2' AND qq.round = 2)
             OR (st.task_type IN ('round1', 'review') AND qq.round = 1)
           )
       )) remaining,
       SUM(CASE WHEN st.status IN ('pending', 'in_progress') AND EXISTS (
         SELECT 1 FROM quiz_questions qq
         WHERE qq.point_id = st.point_id
           AND qq.status = 'published'
           AND (
             (st.task_type = 'round2' AND qq.round = 2)
             OR (st.task_type IN ('round1', 'review') AND qq.round = 1)
           )
       ) THEN st.estimated_minutes ELSE 0 END) planned_minutes
     FROM study_tasks st`
  );
  const [improvements] = await pool.query(
    `SELECT id, subject, title, mastery_score, status
     FROM knowledge_points WHERE status IN ('improving', 'mastered')
     ORDER BY updated_at DESC LIMIT 5`
  );
  return { tasks, progress: progress || {}, improvements };
}

function normalizeAnswer(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replaceAll(':', '：')
    .replaceAll('／', '/');
}

function answerMatches(value, answers) {
  const normalized = normalizeAnswer(value);
  return (answers || []).some((answer) => normalizeAnswer(answer) === normalized);
}

async function generateTrainingPlan(pool, body) {
  const pointId = body.pointId;
  const round = Number(body.round || 1);
  const [[point]] = await pool.query('SELECT * FROM knowledge_points WHERE id = ?', [pointId]);
  if (!point) throw new Error('找不到需要训练的知识点。');
  if (![1, 2].includes(round)) throw new Error('训练轮次必须是第一轮或第二轮。');

  const [findings] = await pool.query(
    `SELECT mf.*, m.title material_title
     FROM material_findings mf
     JOIN materials m ON m.id = mf.material_id
     WHERE mf.review_status = 'accepted'
       AND (mf.knowledge_code = ? OR mf.title = ?)
     ORDER BY mf.created_at DESC LIMIT 8`,
    [point.catalog_code || '', point.title]
  );
  const [roundOneQuestions] = await pool.query(
    'SELECT * FROM quiz_questions WHERE point_id = ? AND round = 1 ORDER BY question_index',
    [pointId]
  );
  const [[roundOneResult]] = await pool.query(
    'SELECT * FROM quiz_results WHERE point_id = ? AND round = 1 ORDER BY completed_at DESC LIMIT 1',
    [pointId]
  );
  const wrongAnswerSummary = [];
  if (roundOneResult) {
    const details = safeJson(roundOneResult.answers, {});
    for (const question of roundOneQuestions) {
      const answer = details[question.id];
      if (answer && !answer.correct) {
        wrongAnswerSummary.push({
          prompt: question.prompt,
          answer: answer.answer,
          correctAnswer: safeJson(question.answers, [])[0],
          tag: question.tag,
          expectedError: question.expected_error
        });
      }
    }
  }

  const questionCount = Math.max(6, Math.min(12, Number(body.questionCount || 8)));
  const taskType = round === 1 ? 'quiz-round1' : 'quiz-round2';
  const lockedQuestions = body.keepLocked
    ? (await pool.query(
        'SELECT * FROM quiz_questions WHERE point_id = ? AND round = ? AND is_locked = 1 ORDER BY question_index',
        [pointId, round]
      ))[0]
    : [];
  const requiredCount = Math.max(1, questionCount - lockedQuestions.length);

  let aiResult;
  let quality;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    aiResult = await runAiTask({
      pool,
      taskType,
      subject: point.subject,
      pointId,
      variables: {
        subject: point.subject,
        grade: point.grade,
        semester: point.semester,
        knowledgeTitle: point.title,
        knowledgeGoal: point.goal,
        evidenceSummary: findings.map((finding) => ({
          material: finding.material_title,
          evidence: finding.evidence_text,
          studentAnswer: finding.student_answer,
          expectedAnswer: finding.expected_answer,
          reason: finding.reason
        })),
        wrongAnswerSummary,
        minutes: Number(body.minutes || 10),
        questionCount: requiredCount,
        qualityFeedback: attempt === 0 ? [] : quality.issues
      }
    });
    const generated = (aiResult.output.questions || []).slice(0, requiredCount);
    const combined = [
      ...lockedQuestions.map((question) => ({
        type: question.type,
        prompt: question.prompt,
        options: safeJson(question.options, []),
        answers: safeJson(question.answers, []),
        explanation: question.explanation,
        tag: question.tag,
        difficulty: question.difficulty,
        sourceBasis: question.source_basis,
        expectedError: question.expected_error,
        locked: true
      })),
      ...generated
    ];
    quality = reviewQuestions(
      combined,
      round === 2 ? roundOneQuestions.map((question) => ({ prompt: question.prompt })) : [],
      round
    );
    aiResult.combinedQuestions = combined;
    if (quality.passed) break;
  }

  const planId = `plan-${pointId}-${round}`;
  const questions = aiResult.combinedQuestions || [];
  await pool.query(
    `INSERT INTO training_plans
      (id, point_id, round, title, goal, status, estimated_minutes, question_count,
       coverage, generation_source, ai_run_id, quality_score, quality_issues)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, 'ai', ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      title = VALUES(title), goal = VALUES(goal), status = 'draft',
      estimated_minutes = VALUES(estimated_minutes), question_count = VALUES(question_count),
      coverage = VALUES(coverage), ai_run_id = VALUES(ai_run_id),
      quality_score = VALUES(quality_score), quality_issues = VALUES(quality_issues),
      published_at = NULL`,
    [
      planId,
      pointId,
      round,
      `${point.title} - 第${round}轮`,
      aiResult.output.plan?.goal || point.goal,
      Number(aiResult.output.plan?.minutes || body.minutes || 10),
      questions.length,
      JSON.stringify(aiResult.output.plan?.coverage || []),
      aiResult.runId,
      quality.score,
      JSON.stringify(quality.issues)
    ]
  );

  await pool.query(
    'DELETE FROM quiz_questions WHERE point_id = ? AND round = ? AND is_locked = 0',
    [pointId, round]
  );
  for (const [index, question] of questions.entries()) {
    if (question.locked) continue;
    const id = `${pointId}-${round}-${createId('q').slice(-12)}-${index + 1}`;
    await pool.query(
      `INSERT INTO quiz_questions
        (id, point_id, round, type, prompt, options, answers, explanation, tag, question_index,
         difficulty, source_basis, expected_error, semantic_hash, quality_status, is_locked,
         version, generation_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, 'draft')`,
      [
        id,
        pointId,
        round,
        question.type,
        question.prompt,
        JSON.stringify(question.options || []),
        JSON.stringify(question.answers || []),
        question.explanation || '',
        question.tag || point.title,
        index + 1,
        Number(question.difficulty || round),
        question.sourceBasis || '',
        question.expectedError || '',
        semanticHash(question),
        quality.passed ? 'passed' : 'needs_review',
        aiResult.runId
      ]
    );
  }
  await pool.query(
    `INSERT INTO quiz_quality_reviews (plan_id, passed, score, issues, duplicate_rate)
     VALUES (?, ?, ?, ?, ?)`,
    [planId, quality.passed ? 1 : 0, quality.score, JSON.stringify(quality.issues), quality.duplicateRate]
  );
  await audit(pool, 'training_plan', planId, 'generated', { quality, aiRunId: aiResult.runId });
  return { planId, quality, questionCount: questions.length };
}

async function getTrainingPlans(pool) {
  const [plans] = await pool.query(
    `SELECT tp.*, kp.subject, kp.title point_title, kp.priority, kp.mastery_score
     FROM training_plans tp
     JOIN knowledge_points kp ON kp.id = tp.point_id
     ORDER BY tp.updated_at DESC`
  );
  for (const plan of plans) {
    const [questions] = await pool.query(
      'SELECT * FROM quiz_questions WHERE point_id = ? AND round = ? ORDER BY question_index',
      [plan.point_id, plan.round]
    );
    plan.coverage = safeJson(plan.coverage, []);
    plan.quality_issues = safeJson(plan.quality_issues, []);
    plan.questions = questions.map((question) => ({
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      options: safeJson(question.options, []),
      answers: safeJson(question.answers, []),
      explanation: question.explanation,
      tag: question.tag,
      difficulty: question.difficulty,
      sourceBasis: question.source_basis || '',
      expectedError: question.expected_error || '',
      qualityStatus: question.quality_status,
      locked: Boolean(question.is_locked),
      status: question.status
    }));
  }
  return plans;
}

async function recheckPlan(pool, planId) {
  const [[plan]] = await pool.query('SELECT * FROM training_plans WHERE id = ?', [planId]);
  if (!plan) throw new Error('找不到训练计划。');
  const [questions] = await pool.query(
    'SELECT * FROM quiz_questions WHERE point_id = ? AND round = ? ORDER BY question_index',
    [plan.point_id, plan.round]
  );
  const [existing] = plan.round === 2
    ? await pool.query('SELECT prompt FROM quiz_questions WHERE point_id = ? AND round = 1', [plan.point_id])
    : [[]];
  const normalized = questions.map((question) => ({
    type: question.type,
    prompt: question.prompt,
    options: safeJson(question.options, []),
    answers: safeJson(question.answers, []),
    explanation: question.explanation,
    tag: question.tag,
    sourceBasis: question.source_basis
  }));
  const quality = reviewQuestions(normalized, existing, plan.round);
  await pool.query(
    'UPDATE training_plans SET quality_score = ?, quality_issues = ? WHERE id = ?',
    [quality.score, JSON.stringify(quality.issues), planId]
  );
  await pool.query(
    'UPDATE quiz_questions SET quality_status = ? WHERE point_id = ? AND round = ?',
    [quality.passed ? 'passed' : 'needs_review', plan.point_id, plan.round]
  );
  await pool.query(
    `INSERT INTO quiz_quality_reviews (plan_id, passed, score, issues, duplicate_rate)
     VALUES (?, ?, ?, ?, ?)`,
    [planId, quality.passed ? 1 : 0, quality.score, JSON.stringify(quality.issues), quality.duplicateRate]
  );
  return quality;
}

async function submitQuiz(pool, body) {
  const pointId = body.pointId;
  const round = Number(body.round);
  const answers = body.answers || {};
  const [questions] = await pool.query(
    `SELECT * FROM quiz_questions
     WHERE point_id = ? AND round = ? AND status = 'published'
     ORDER BY question_index`,
    [pointId, round]
  );
  if (!questions.length) throw new Error('这个训练尚未发布或没有题目。');
  const [[point]] = await pool.query('SELECT * FROM knowledge_points WHERE id = ?', [pointId]);
  if (!point) throw new Error('找不到知识点。');

  let correctCount = 0;
  const wrongTags = [];
  const details = {};
  for (const question of questions) {
    const userAnswer = answers[question.id] || '';
    const correctAnswers = safeJson(question.answers, []);
    const correct = answerMatches(userAnswer, correctAnswers);
    if (correct) correctCount += 1;
    else wrongTags.push(question.tag);
    details[question.id] = {
      answer: userAnswer,
      correct,
      tag: question.tag,
      expectedError: question.expected_error,
      correctAnswer: correctAnswers[0]
    };
  }
  const score = Math.round((correctCount / questions.length) * 100);
  const [result] = await pool.query(
    `INSERT INTO quiz_results
      (subject, point_id, point_title, round, score, wrong_tags, answers,
       total_count, correct_count, duration_seconds, result_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'quiz')`,
    [
      point.subject,
      pointId,
      point.title,
      round,
      score,
      JSON.stringify([...new Set(wrongTags)]),
      JSON.stringify(details),
      questions.length,
      correctCount,
      Number(body.durationSeconds || 0)
    ]
  );

  const previousMastery = Number(point.mastery_score || 0);
  const weight = round === 1 ? 0.45 : 0.65;
  const masteryScore = Math.round(previousMastery * (1 - weight) + score * weight);
  const nextStatus = masteryStatus(masteryScore, Number(point.occurrence_count || 1));
  const reviewDays = masteryScore >= 85 ? 7 : masteryScore >= 65 ? 3 : 1;
  await pool.query(
    `UPDATE knowledge_points
     SET mastery_score = ?, confidence_score = LEAST(100, confidence_score + 8),
       status = ?, next_review_at = DATE_ADD(NOW(), INTERVAL ? DAY)
     WHERE id = ?`,
    [masteryScore, nextStatus, reviewDays, pointId]
  );
  await pool.query(
    `INSERT INTO mastery_snapshots
      (point_id, mastery_score, confidence_score, status, reason, source_type, source_id)
     VALUES (?, ?, ?, ?, ?, 'quiz', ?)`,
    [
      pointId,
      masteryScore,
      Math.min(100, Number(point.confidence_score || 50) + 8),
      nextStatus,
      `第${round}轮测试得分 ${score} 分`,
      String(result.insertId)
    ]
  );

  const completedTaskType = round === 1 ? 'round1' : 'round2';
  await pool.query(
    `UPDATE study_tasks
     SET status = 'completed', completed_at = NOW()
     WHERE point_id = ? AND task_type = ? AND status IN ('pending', 'in_progress')`,
    [pointId, completedTaskType]
  );
  if (round === 1 && score < 90) {
    await pool.query(
      `INSERT INTO study_tasks
        (id, subject, point_id, title, reason, task_type, status, priority, estimated_minutes, mastery_goal, due_at)
       VALUES (?, ?, ?, ?, ?, 'round2', 'pending', ?, 10, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))
       ON DUPLICATE KEY UPDATE status = 'pending', due_at = VALUES(due_at), reason = VALUES(reason)`,
      [
        `round2-${pointId}`,
        point.subject,
        pointId,
        `第二轮强化：${point.title}`,
        wrongTags.length ? `重点处理：${[...new Set(wrongTags)].join('、')}` : '进行迁移巩固',
        point.priority,
        '第二轮达到 85 分'
      ]
    );
  }
  await pool.query(
    `INSERT INTO study_tasks
      (id, subject, point_id, title, reason, task_type, status, priority, estimated_minutes, mastery_goal, due_at)
     VALUES (?, ?, ?, ?, ?, 'review', 'pending', ?, 8, ?, DATE_ADD(NOW(), INTERVAL ? DAY))
     ON DUPLICATE KEY UPDATE status = 'pending', due_at = VALUES(due_at), reason = VALUES(reason)`,
    [
      `review-${pointId}`,
      point.subject,
      pointId,
      `到期复习：${point.title}`,
      `检查第${round}轮训练后的保持情况`,
      point.priority,
      '在新情境中保持 85 分以上',
      reviewDays
    ]
  );

  return {
    resultId: result.insertId,
    score,
    correctCount,
    totalCount: questions.length,
    wrongTags: [...new Set(wrongTags)],
    details,
    masteryScore,
    status: nextStatus,
    nextReviewDays: reviewDays
  };
}

async function getQuizResultDetail(pool, resultId) {
  const [[result]] = await pool.query('SELECT * FROM quiz_results WHERE id = ?', [resultId]);
  if (!result) throw new Error('找不到这次训练记录。');
  const [questions] = await pool.query(
    `SELECT * FROM quiz_questions
     WHERE point_id = ? AND round = ?
     ORDER BY question_index`,
    [result.point_id, result.round]
  );
  const answers = safeJson(result.answers, {});
  const wrongDetails = questions
    .filter((question) => answers[question.id] && !answers[question.id].correct)
    .map((question) => ({
      questionId: question.id,
      prompt: question.prompt,
      studentAnswer: answers[question.id].answer || '',
      correctAnswer: answers[question.id].correctAnswer || safeJson(question.answers, [])[0] || '',
      explanation: question.explanation || '',
      expectedError: question.expected_error || '',
      tag: question.tag || ''
    }));
  return {
    id: result.id,
    subject: result.subject,
    pointId: result.point_id,
    pointTitle: result.point_title,
    round: Number(result.round),
    score: Number(result.score),
    wrongTags: safeJson(result.wrong_tags, []),
    completedAt: result.completed_at,
    wrongDetails
  };
}

async function reportData(pool, period = 'week') {
  const days = period === 'month' ? 30 : 7;
  const [[summary], [subjects], [improvements], [persistent], [results]] = await Promise.all([
    pool.query(
      `SELECT
        (SELECT COUNT(*) FROM materials WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) materials,
        (SELECT COUNT(*) FROM material_findings WHERE review_status = 'accepted' AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) findings,
        (SELECT COUNT(*) FROM quiz_results WHERE completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) quizzes,
        (SELECT AVG(score) FROM quiz_results WHERE completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) average_score`,
      [days, days, days, days]
    ),
    pool.query(
      `SELECT subject, COUNT(*) materials
       FROM materials WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY subject`,
      [days]
    ),
    pool.query(
      `SELECT id, subject, title, mastery_score, status
       FROM knowledge_points WHERE status IN ('improving', 'mastered')
       ORDER BY updated_at DESC LIMIT 8`
    ),
    pool.query(
      `SELECT id, subject, title, mastery_score, occurrence_count, priority
       FROM knowledge_points WHERE status IN ('persistent', 'new')
       ORDER BY FIELD(priority, 'P0', 'P1', 'P2'), occurrence_count DESC LIMIT 8`
    ),
    pool.query(
      `SELECT subject, round, AVG(score) average_score, COUNT(*) count
       FROM quiz_results WHERE completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY subject, round`,
      [days]
    )
  ]);
  return { period, days, summary: summary[0] || {}, subjects, improvements, persistent, results };
}

async function configOverview(pool) {
  const [[skills], [prompts], [models], [routes], [runs]] = await Promise.all([
    pool.query('SELECT * FROM skills ORDER BY subject, name'),
    pool.query('SELECT * FROM prompt_templates ORDER BY task_type, name'),
    pool.query('SELECT * FROM model_configs ORDER BY provider, name'),
    pool.query('SELECT * FROM task_routes ORDER BY task_type, subject, material_type'),
    pool.query('SELECT * FROM ai_runs ORDER BY created_at DESC LIMIT 100')
  ]);
  return {
    skills,
    prompts,
    models: models.map((model) => ({
      ...model,
      keyConfigured: null
    })),
    routes,
    runs
  };
}

async function handleRequest(req, res, next) {
  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = parsedUrl.pathname;
  if (!pathname.startsWith('/api/')) return next();

  try {
    const pool = await getPool();

    if (pathname === '/api/login' && req.method === 'POST') {
      const auth = await loadAuthConfig();
      const body = await parseBody(req);
      if (auth.mode !== 'mysql') {
        const success = body.password === auth.password;
        return sendJson(res, success ? 200 : 401, {
          success,
          message: success ? '登录成功。' : '密码不正确。'
        });
      }
      const [rows] = await pool.query(
        'SELECT id FROM users WHERE username = ? AND password = ?',
        [body.username, body.password]
      );
      return sendJson(res, rows.length ? 200 : 401, {
        success: rows.length > 0,
        message: rows.length ? '登录成功。' : '用户名或密码不正确。'
      });
    }

    if (pathname === '/api/dashboard' && req.method === 'GET') {
      return sendJson(res, 200, { success: true, data: await getDashboard(pool) });
    }

    if (pathname === '/api/student/today' && req.method === 'GET') {
      return sendJson(res, 200, { success: true, data: await getToday(pool) });
    }

    if (pathname === '/api/profile' && req.method === 'GET') {
      const [[profile]] = await pool.query("SELECT * FROM student_profiles WHERE id = 'leo'");
      return sendJson(res, 200, { success: true, data: profile });
    }

    if (pathname === '/api/profile' && req.method === 'PATCH') {
      const body = await parseBody(req);
      await pool.query(
        `UPDATE student_profiles SET
          grade = ?, semester = ?, textbook_version = ?, school_requirements = ?,
          long_term_goal = ?, daily_minutes = ?
         WHERE id = 'leo'`,
        [
          body.grade,
          body.semester,
          body.textbookVersion || '待确认',
          body.schoolRequirements || '',
          body.longTermGoal || '',
          Number(body.dailyMinutes || 20)
        ]
      );
      await audit(pool, 'profile', 'leo', 'updated', body);
      return sendJson(res, 200, { success: true });
    }

    if (pathname === '/api/materials' && req.method === 'GET') {
      return sendJson(res, 200, { success: true, data: await getMaterials(pool, parsedUrl.searchParams) });
    }

    if (pathname === '/api/materials' && req.method === 'POST') {
      const body = await parseBody(req);
      const required = ['subject', 'date', 'type', 'title'];
      if (required.some((key) => !body[key])) {
        return sendJson(res, 400, { success: false, message: '科目、日期、素材类型和标题不能为空。' });
      }
      if (!Array.isArray(body.uploadedFiles) || !body.uploadedFiles.length) {
        return sendJson(res, 400, { success: false, message: '请至少上传一个文件。' });
      }
      const id = createId(`material-${body.subject}`);
      const material = {
        id,
        subject: body.subject,
        date: body.date,
        type: body.type,
        title: body.title
      };
      await pool.query(
        `INSERT INTO materials
          (id, subject, date, type, title, priority, score, summary, raw_files,
           analysis_file, analysis_summary, analysis_strengths, analysis_needs_improvement,
           learning_links, status, grade, semester, textbook_version, unit_name,
           has_answers, has_teacher_marks, analysis_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', '', '', '[]', '[]', '[]',
           'pending_processing', ?, ?, ?, ?, ?, ?, 'not_started')`,
        [
          id,
          body.subject,
          body.date,
          body.type,
          body.title.trim(),
          body.priority || 'P1',
          body.score === '' || body.score === null || body.score === undefined ? null : Number(body.score),
          body.summary || '',
          body.grade || '小学五年级',
          body.semester || '下学期',
          body.textbookVersion || '待确认',
          body.unitName || '',
          body.hasAnswers ? 1 : 0,
          body.hasTeacherMarks ? 1 : 0
        ]
      );
      try {
        const saved = await saveUploadedFiles(pool, material, body.uploadedFiles);
        await pool.query(
          `UPDATE materials SET raw_files = ?, status = 'pending_analysis',
            source_hash = ?, analysis_status = 'not_started'
           WHERE id = ?`,
          [
            JSON.stringify(saved.rawFiles),
            hashText(saved.rawFiles.map((file) => file.hash).join('|')),
            id
          ]
        );
        await audit(pool, 'material', id, 'created', {
          files: saved.rawFiles.length,
          pages: saved.pages.length
        });
        return sendJson(res, 201, { success: true, id, pages: saved.pages });
      } catch (error) {
        await pool.query(
          `UPDATE materials SET status = 'processing_failed', processing_error = ? WHERE id = ?`,
          [error.message, id]
        );
        throw error;
      }
    }

    const materialParams = routeMatch(pathname, '/api/materials/:id');
    if (materialParams && req.method === 'GET') {
      return sendJson(res, 200, { success: true, data: await getMaterialDetail(pool, materialParams.id) });
    }
    if (materialParams && req.method === 'PATCH') {
      const body = await parseBody(req);
      await pool.query(
        `UPDATE materials SET
          title = COALESCE(?, title), type = COALESCE(?, type), priority = COALESCE(?, priority),
          summary = COALESCE(?, summary), grade = COALESCE(?, grade),
          semester = COALESCE(?, semester), textbook_version = COALESCE(?, textbook_version),
          unit_name = COALESCE(?, unit_name), has_answers = COALESCE(?, has_answers),
          has_teacher_marks = COALESCE(?, has_teacher_marks)
         WHERE id = ?`,
        [
          body.title ?? null,
          body.type ?? null,
          body.priority ?? null,
          body.summary ?? null,
          body.grade ?? null,
          body.semester ?? null,
          body.textbookVersion ?? null,
          body.unitName ?? null,
          body.hasAnswers === undefined ? null : body.hasAnswers ? 1 : 0,
          body.hasTeacherMarks === undefined ? null : body.hasTeacherMarks ? 1 : 0,
          materialParams.id
        ]
      );
      await audit(pool, 'material', materialParams.id, 'updated', body);
      return sendJson(res, 200, { success: true });
    }

    const analyzeParams = routeMatch(pathname, '/api/materials/:id/analyze');
    if (analyzeParams && req.method === 'POST') {
      const result = await analyzeMaterial(pool, analyzeParams.id);
      return sendJson(res, 200, { success: true, ...result });
    }

    const confirmParams = routeMatch(pathname, '/api/materials/:id/confirm');
    if (confirmParams && req.method === 'POST') {
      const body = await parseBody(req);
      await confirmMaterial(pool, confirmParams.id, body);
      return sendJson(res, 200, { success: true });
    }

    const questionParams = routeMatch(pathname, '/api/materials/:id/questions/:questionId');
    if (questionParams && req.method === 'PATCH') {
      const body = await parseBody(req);
      await pool.query(
        `UPDATE material_questions SET
          question_number = ?, question_type = ?, score = ?, prompt = ?, student_answer = ?,
          correct_answer = ?, teacher_mark = ?, evidence_text = ?, confidence = ?,
          review_required = ?, review_status = ?
         WHERE id = ? AND material_id = ?`,
        [
          body.number,
          body.type || '',
          body.score === '' ? null : body.score,
          body.prompt || '',
          body.studentAnswer || '',
          body.correctAnswer || '',
          body.teacherMark || '',
          body.evidenceText || '',
          Number(body.confidence || 0),
          body.reviewRequired ? 1 : 0,
          body.reviewStatus || 'pending',
          questionParams.questionId,
          questionParams.id
        ]
      );
      await audit(pool, 'material_question', questionParams.questionId, 'updated', body);
      return sendJson(res, 200, { success: true });
    }

    const findingParams = routeMatch(pathname, '/api/materials/:id/findings/:findingId');
    if (findingParams && req.method === 'PATCH') {
      const body = await parseBody(req);
      await pool.query(
        `UPDATE material_findings SET
          title = ?, category = ?, priority = ?, reason = ?, knowledge_code = ?,
          evidence_text = ?, student_answer = ?, expected_answer = ?, confidence = ?,
          review_required = ?, review_status = ?, reviewer_note = ?
         WHERE id = ? AND material_id = ?`,
        [
          body.title,
          body.category,
          body.priority,
          body.reason,
          body.knowledgeCode || '',
          body.evidenceText || '',
          body.studentAnswer || '',
          body.expectedAnswer || '',
          Number(body.confidence || 0),
          body.reviewRequired ? 1 : 0,
          body.reviewStatus || 'pending',
          body.reviewerNote || '',
          findingParams.findingId,
          findingParams.id
        ]
      );
      await audit(pool, 'material_finding', findingParams.findingId, 'updated', body);
      return sendJson(res, 200, { success: true });
    }

    const pageParams = routeMatch(pathname, '/api/materials/:id/pages/:pageId/rotate');
    if (pageParams && req.method === 'POST') {
      const body = await parseBody(req);
      const degrees = [90, 180, 270].includes(Number(body.degrees)) ? Number(body.degrees) : 90;
      const [[page]] = await pool.query(
        'SELECT * FROM material_pages WHERE id = ? AND material_id = ?',
        [pageParams.pageId, pageParams.id]
      );
      if (!page) throw new Error('找不到素材页。');
      const sourcePath = path.join(projectRoot, page.source);
      const publicPath = path.join(siteRoot, 'public/materials', page.source);
      await execFileAsync('/usr/bin/sips', ['-r', String(degrees), sourcePath]);
      await fs.copyFile(sourcePath, publicPath);
      await pool.query(
        'UPDATE material_pages SET rotation = MOD(rotation + ?, 360) WHERE id = ?',
        [degrees, page.id]
      );
      return sendJson(res, 200, { success: true });
    }

    if (pathname === '/api/knowledge/catalog' && req.method === 'GET') {
      const [rows] = await pool.query('SELECT * FROM knowledge_catalog WHERE enabled = 1 ORDER BY subject, unit_name, title');
      return sendJson(res, 200, { success: true, data: rows.map((row) => ({
        ...row,
        prerequisite_codes: safeJson(row.prerequisite_codes, [])
      })) });
    }

    if (pathname === '/api/knowledge-points' && req.method === 'GET') {
      return sendJson(res, 200, { success: true, data: await getKnowledgePoints(pool, parsedUrl.searchParams) });
    }

    if (pathname === '/api/knowledge-points' && req.method === 'POST') {
      const body = await parseBody(req);
      const id = createId(`kp-${body.subject}`).slice(0, 50);
      await pool.query(
        `INSERT INTO knowledge_points
          (id, subject, priority, title, reason, goal, checkpoints, practice_files,
           evidence_material_ids, catalog_code, status, mastery_score, confidence_score,
           occurrence_count, next_review_at, grade, semester, textbook_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', 0, 50, 1, NOW(), ?, ?, ?)`,
        [
          id,
          body.subject,
          body.priority || 'P1',
          body.title,
          body.reason,
          body.goal,
          JSON.stringify(body.checkpoints || []),
          JSON.stringify(body.practiceFiles || []),
          JSON.stringify(body.evidenceMaterialIds || []),
          body.catalogCode || '',
          body.grade || '小学五年级',
          body.semester || '下学期',
          body.textbookVersion || '待确认'
        ]
      );
      return sendJson(res, 201, { success: true, id });
    }

    const pointParams = routeMatch(pathname, '/api/knowledge-points/:id');
    if (pointParams && req.method === 'PATCH') {
      const body = await parseBody(req);
      await pool.query(
        `UPDATE knowledge_points SET
          priority = ?, title = ?, reason = ?, goal = ?, catalog_code = ?, status = ?,
          mastery_score = ?, confidence_score = ?, next_review_at = ?, grade = ?,
          semester = ?, textbook_version = ?, checkpoints = ?
         WHERE id = ?`,
        [
          body.priority,
          body.title,
          body.reason,
          body.goal,
          body.catalogCode || '',
          body.status,
          Number(body.masteryScore || 0),
          Number(body.confidenceScore || 0),
          body.nextReviewAt || null,
          body.grade,
          body.semester,
          body.textbookVersion,
          JSON.stringify(body.checkpoints || []),
          pointParams.id
        ]
      );
      await audit(pool, 'knowledge_point', pointParams.id, 'updated', body);
      return sendJson(res, 200, { success: true });
    }

    const timelineParams = routeMatch(pathname, '/api/knowledge-points/:id/timeline');
    if (timelineParams && req.method === 'GET') {
      return sendJson(res, 200, { success: true, data: await getKnowledgeTimeline(pool, timelineParams.id) });
    }

    if (pathname === '/api/tasks' && req.method === 'GET') {
      const [rows] = await pool.query('SELECT * FROM study_tasks ORDER BY due_at, sort_order, created_at');
      return sendJson(res, 200, { success: true, data: rows });
    }

    const taskParams = routeMatch(pathname, '/api/tasks/:id');
    if (taskParams && req.method === 'PATCH') {
      const body = await parseBody(req);
      await pool.query(
        `UPDATE study_tasks SET
          status = COALESCE(?, status), estimated_minutes = COALESCE(?, estimated_minutes),
          due_at = COALESCE(?, due_at), sort_order = COALESCE(?, sort_order),
          completed_at = CASE WHEN ? = 'completed' THEN NOW() ELSE completed_at END
         WHERE id = ?`,
        [
          body.status ?? null,
          body.estimatedMinutes ?? null,
          body.dueAt ?? null,
          body.sortOrder ?? null,
          body.status ?? null,
          taskParams.id
        ]
      );
      await audit(pool, 'study_task', taskParams.id, 'updated', body);
      return sendJson(res, 200, { success: true });
    }

    if (pathname === '/api/training-plans' && req.method === 'GET') {
      return sendJson(res, 200, { success: true, data: await getTrainingPlans(pool) });
    }

    if (pathname === '/api/training-plans/generate' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 200, { success: true, ...(await generateTrainingPlan(pool, body)) });
    }

    const planPublishParams = routeMatch(pathname, '/api/training-plans/:id/publish');
    if (planPublishParams && req.method === 'POST') {
      const quality = await recheckPlan(pool, planPublishParams.id);
      if (!quality.passed) {
        return sendJson(res, 409, {
          success: false,
          message: '题目质量检查未通过，请先修改或重新生成。',
          quality
        });
      }
      const [[plan]] = await pool.query('SELECT * FROM training_plans WHERE id = ?', [planPublishParams.id]);
      await pool.query(
        `UPDATE training_plans SET status = 'published', published_at = NOW() WHERE id = ?`,
        [planPublishParams.id]
      );
      await pool.query(
        `UPDATE quiz_questions SET status = 'published'
         WHERE point_id = ? AND round = ?`,
        [plan.point_id, plan.round]
      );
      await audit(pool, 'training_plan', planPublishParams.id, 'published', quality);
      return sendJson(res, 200, { success: true, quality });
    }

    const planCheckParams = routeMatch(pathname, '/api/training-plans/:id/check');
    if (planCheckParams && req.method === 'POST') {
      return sendJson(res, 200, { success: true, quality: await recheckPlan(pool, planCheckParams.id) });
    }

    const quizQuestionParams = routeMatch(pathname, '/api/quiz/questions/:id');
    if (quizQuestionParams && req.method === 'PATCH') {
      const body = await parseBody(req);
      await pool.query(
        `UPDATE quiz_questions SET
          type = ?, prompt = ?, options = ?, answers = ?, explanation = ?, tag = ?,
          difficulty = ?, source_basis = ?, expected_error = ?, is_locked = ?,
          semantic_hash = ?, quality_status = 'unchecked'
         WHERE id = ?`,
        [
          body.type,
          body.prompt,
          JSON.stringify(body.options || []),
          JSON.stringify(body.answers || []),
          body.explanation || '',
          body.tag || '',
          Number(body.difficulty || 1),
          body.sourceBasis || '',
          body.expectedError || '',
          body.locked ? 1 : 0,
          semanticHash(body),
          quizQuestionParams.id
        ]
      );
      await audit(pool, 'quiz_question', quizQuestionParams.id, 'updated', body);
      return sendJson(res, 200, { success: true });
    }
    if (quizQuestionParams && req.method === 'DELETE') {
      await pool.query('DELETE FROM quiz_questions WHERE id = ?', [quizQuestionParams.id]);
      await audit(pool, 'quiz_question', quizQuestionParams.id, 'deleted');
      return sendJson(res, 200, { success: true });
    }

    if (pathname === '/api/quiz/questions' && req.method === 'GET') {
      const pointId = parsedUrl.searchParams.get('pointId');
      const round = Number(parsedUrl.searchParams.get('round') || 1);
      const [rows] = await pool.query(
        `SELECT * FROM quiz_questions
         WHERE point_id = ? AND round = ? AND status = 'published'
         ORDER BY question_index`,
        [pointId, round]
      );
      return sendJson(res, 200, {
        success: true,
        data: rows.map((row) => ({
          id: row.id,
          pointId: row.point_id,
          round: row.round,
          type: row.type,
          prompt: row.prompt,
          options: safeJson(row.options, []),
          answers: safeJson(row.answers, []),
          explanation: row.explanation,
          tag: row.tag,
          index: row.question_index,
          difficulty: row.difficulty,
          sourceBasis: row.source_basis
        }))
      });
    }

    if (pathname === '/api/quiz/submit' && req.method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 200, { success: true, ...(await submitQuiz(pool, body)) });
    }

    const resultExplainParams = routeMatch(pathname, '/api/quiz/results/:id/explain');
    if (resultExplainParams && req.method === 'POST') {
      const detail = await getQuizResultDetail(pool, Number(resultExplainParams.id));
      if (!detail.wrongDetails.length) {
        return sendJson(res, 400, { success: false, message: '这次训练没有需要生成讲解的错题。' });
      }
      const ai = await runAiTask({
        pool,
        taskType: 'leo-explanation',
        subject: detail.subject,
        pointId: detail.pointId,
        variables: {
          grade: '小学五年级',
          semester: '下学期',
          pointTitle: detail.pointTitle,
          wrongDetails: detail.wrongDetails
        }
      });
      return sendJson(res, 200, {
        success: true,
        explanation: ai.output,
        provenance: ai.provenance
      });
    }

    if (pathname === '/api/quiz/history' && req.method === 'GET') {
      const [rows] = await pool.query('SELECT * FROM quiz_results ORDER BY completed_at DESC');
      const details = [];
      for (const row of rows) details.push(await getQuizResultDetail(pool, row.id));
      return sendJson(res, 200, {
        success: true,
        data: details
      });
    }

    if (pathname === '/api/reports' && req.method === 'GET') {
      return sendJson(res, 200, {
        success: true,
        data: await reportData(pool, parsedUrl.searchParams.get('period') || 'week')
      });
    }

    if (pathname === '/api/reports/generate' && req.method === 'POST') {
      const body = await parseBody(req);
      const data = await reportData(pool, body.period || 'week');
      const ai = await runAiTask({
        pool,
        taskType: 'report',
        variables: {
          subject: '*',
          grade: body.grade || '小学五年级',
          semester: body.semester || '下学期',
          reportData: data
        }
      });
      return sendJson(res, 200, {
        success: true,
        data: {
          report: data,
          narrative: ai.output,
          provenance: ai.provenance
        }
      });
    }

    if (pathname === '/api/config' && req.method === 'GET') {
      const data = await configOverview(pool);
      const auth = await loadAuthConfig();
      data.models = data.models.map((model) => ({
        ...model,
        keyConfigured: Boolean(auth[model.key_ref])
      }));
      return sendJson(res, 200, { success: true, data });
    }

    const skillParams = routeMatch(pathname, '/api/config/skills/:slug');
    if (skillParams && req.method === 'GET') {
      const [[skill], [versions]] = await Promise.all([
        pool.query(
          `SELECT s.*, sv.content active_content
           FROM skills s
           JOIN skill_versions sv ON sv.skill_slug = s.slug AND sv.version = s.active_version
           WHERE s.slug = ?`,
          [skillParams.slug]
        ),
        pool.query(
          'SELECT id, skill_slug, version, status, change_note, created_at FROM skill_versions WHERE skill_slug = ? ORDER BY version DESC',
          [skillParams.slug]
        )
      ]);
      if (!skill.length) throw new Error('找不到技能。');
      return sendJson(res, 200, { success: true, data: { ...skill[0], versions } });
    }

    if (skillParams && req.method === 'POST') {
      const body = await parseBody(req);
      const [[skill]] = await pool.query('SELECT * FROM skills WHERE slug = ?', [skillParams.slug]);
      if (!skill) throw new Error('找不到技能。');
      const [[latest]] = await pool.query(
        'SELECT MAX(version) latest_version FROM skill_versions WHERE skill_slug = ?',
        [skillParams.slug]
      );
      const version = Number(latest.latest_version || 0) + 1;
      await pool.query(
        `INSERT INTO skill_versions (skill_slug, version, content, status, change_note)
         VALUES (?, ?, ?, 'draft', ?)`,
        [skillParams.slug, version, body.content, body.changeNote || '保存草稿']
      );
      return sendJson(res, 201, { success: true, version });
    }

    const skillPublishParams = routeMatch(pathname, '/api/config/skills/:slug/publish');
    if (skillPublishParams && req.method === 'POST') {
      const body = await parseBody(req);
      const [[skill]] = await pool.query('SELECT * FROM skills WHERE slug = ?', [skillPublishParams.slug]);
      const [[version]] = await pool.query(
        'SELECT * FROM skill_versions WHERE skill_slug = ? AND version = ?',
        [skillPublishParams.slug, Number(body.version)]
      );
      if (!skill || !version) throw new Error('找不到技能版本。');
      await pool.query('UPDATE skill_versions SET status = "archived" WHERE skill_slug = ? AND status = "published"', [skill.slug]);
      await pool.query('UPDATE skill_versions SET status = "published" WHERE id = ?', [version.id]);
      await pool.query('UPDATE skills SET active_version = ?, status = "enabled" WHERE slug = ?', [version.version, skill.slug]);
      const filePath = path.join(projectRoot, skill.file_path);
      await fs.writeFile(filePath, version.content, 'utf8');
      await audit(pool, 'skill', skill.slug, 'published', { version: version.version });
      return sendJson(res, 200, { success: true });
    }

    const skillRollbackParams = routeMatch(pathname, '/api/config/skills/:slug/rollback');
    if (skillRollbackParams && req.method === 'POST') {
      const body = await parseBody(req);
      const [[skill]] = await pool.query('SELECT * FROM skills WHERE slug = ?', [skillRollbackParams.slug]);
      const [[version]] = await pool.query(
        'SELECT * FROM skill_versions WHERE skill_slug = ? AND version = ?',
        [skillRollbackParams.slug, Number(body.version)]
      );
      if (!skill || !version) throw new Error('找不到技能版本。');
      await pool.query('UPDATE skill_versions SET status = "archived" WHERE skill_slug = ? AND status = "published"', [skill.slug]);
      await pool.query('UPDATE skill_versions SET status = "published" WHERE id = ?', [version.id]);
      await pool.query('UPDATE skills SET active_version = ? WHERE slug = ?', [version.version, skill.slug]);
      await fs.writeFile(path.join(projectRoot, skill.file_path), version.content, 'utf8');
      await audit(pool, 'skill', skill.slug, 'rolled_back', { version: version.version });
      return sendJson(res, 200, { success: true });
    }

    const promptParams = routeMatch(pathname, '/api/config/prompts/:slug');
    if (promptParams && req.method === 'GET') {
      const [[prompt], [versions]] = await Promise.all([
        pool.query(
          `SELECT p.*, pv.content active_content, pv.variables, pv.test_score, pv.test_note
           FROM prompt_templates p
           JOIN prompt_versions pv ON pv.prompt_slug = p.slug AND pv.version = p.active_version
           WHERE p.slug = ?`,
          [promptParams.slug]
        ),
        pool.query(
          'SELECT id, prompt_slug, version, status, test_score, test_note, created_at FROM prompt_versions WHERE prompt_slug = ? ORDER BY version DESC',
          [promptParams.slug]
        )
      ]);
      if (!prompt.length) throw new Error('找不到提示词。');
      prompt[0].variables = safeJson(prompt[0].variables, []);
      return sendJson(res, 200, { success: true, data: { ...prompt[0], versions } });
    }

    if (promptParams && req.method === 'POST') {
      const body = await parseBody(req);
      const [[latest]] = await pool.query(
        'SELECT MAX(version) latest_version FROM prompt_versions WHERE prompt_slug = ?',
        [promptParams.slug]
      );
      const version = Number(latest.latest_version || 0) + 1;
      await pool.query(
        `INSERT INTO prompt_versions (prompt_slug, version, content, status, variables, test_score, test_note)
         VALUES (?, ?, ?, 'draft', ?, ?, ?)`,
        [
          promptParams.slug,
          version,
          body.content,
          JSON.stringify(promptVariables(body.content)),
          body.testScore ?? null,
          body.testNote || ''
        ]
      );
      return sendJson(res, 201, { success: true, version });
    }

    const promptPublishParams = routeMatch(pathname, '/api/config/prompts/:slug/publish');
    if (promptPublishParams && req.method === 'POST') {
      const body = await parseBody(req);
      await pool.query('UPDATE prompt_versions SET status = "archived" WHERE prompt_slug = ? AND status = "published"', [promptPublishParams.slug]);
      await pool.query('UPDATE prompt_versions SET status = "published" WHERE prompt_slug = ? AND version = ?', [promptPublishParams.slug, Number(body.version)]);
      await pool.query('UPDATE prompt_templates SET active_version = ?, status = "enabled" WHERE slug = ?', [Number(body.version), promptPublishParams.slug]);
      await audit(pool, 'prompt', promptPublishParams.slug, 'published', { version: Number(body.version) });
      return sendJson(res, 200, { success: true });
    }

    const promptRollbackParams = routeMatch(pathname, '/api/config/prompts/:slug/rollback');
    if (promptRollbackParams && req.method === 'POST') {
      const body = await parseBody(req);
      const [[version]] = await pool.query(
        'SELECT * FROM prompt_versions WHERE prompt_slug = ? AND version = ?',
        [promptRollbackParams.slug, Number(body.version)]
      );
      if (!version) throw new Error('找不到提示词版本。');
      await pool.query(
        'UPDATE prompt_versions SET status = "archived" WHERE prompt_slug = ? AND status = "published"',
        [promptRollbackParams.slug]
      );
      await pool.query('UPDATE prompt_versions SET status = "published" WHERE id = ?', [version.id]);
      await pool.query(
        'UPDATE prompt_templates SET active_version = ?, status = "enabled" WHERE slug = ?',
        [version.version, promptRollbackParams.slug]
      );
      await audit(pool, 'prompt', promptRollbackParams.slug, 'rolled_back', { version: version.version });
      return sendJson(res, 200, { success: true });
    }

    const modelParams = routeMatch(pathname, '/api/config/models/:key');
    if (modelParams && req.method === 'PATCH') {
      const body = await parseBody(req);
      await pool.query(
        `UPDATE model_configs SET
          name = ?, model_name = ?, purpose = ?, temperature = ?, timeout_seconds = ?,
          retry_count = ?, enabled = ?
         WHERE model_key = ?`,
        [
          body.name,
          body.modelName,
          body.purpose,
          Number(body.temperature || 0.2),
          Number(body.timeoutSeconds || 90),
          Number(body.retryCount || 1),
          body.enabled ? 1 : 0,
          modelParams.key
        ]
      );
      await audit(pool, 'model', modelParams.key, 'updated', body);
      return sendJson(res, 200, { success: true });
    }

    const routeParams = routeMatch(pathname, '/api/config/routes/:key');
    if (routeParams && req.method === 'PATCH') {
      const body = await parseBody(req);
      await pool.query(
        `UPDATE task_routes SET
          skill_slug = ?, prompt_slug = ?, model_key = ?, fallback_model_key = ?, enabled = ?
         WHERE route_key = ?`,
        [
          body.skillSlug,
          body.promptSlug,
          body.modelKey,
          body.fallbackModelKey || '',
          body.enabled ? 1 : 0,
          routeParams.key
        ]
      );
      await audit(pool, 'task_route', routeParams.key, 'updated', body);
      return sendJson(res, 200, { success: true });
    }

    const retryParams = routeMatch(pathname, '/api/config/runs/:id/retry');
    if (retryParams && req.method === 'POST') {
      const result = await retryAiRun(pool, Number(retryParams.id));
      return sendJson(res, 200, { success: true, runId: result.runId });
    }

    if (pathname === '/api/system/backup' && req.method === 'GET') {
      const tableNames = [
        'student_profiles',
        'materials',
        'material_pages',
        'material_questions',
        'material_findings',
        'knowledge_catalog',
        'knowledge_points',
        'mastery_snapshots',
        'study_tasks',
        'training_plans',
        'quiz_questions',
        'quiz_results',
        'skills',
        'skill_versions',
        'prompt_templates',
        'prompt_versions',
        'model_configs',
        'task_routes',
        'ai_runs',
        'audit_logs',
        'app_settings'
      ];
      const backup = {
        schemaVersion: 'phase2-backup-v1',
        exportedAt: new Date().toISOString(),
        tables: {}
      };
      for (const tableName of tableNames) {
        backup.tables[tableName] = (await pool.query(`SELECT * FROM \`${tableName}\``))[0];
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="leo-study-backup-${new Date().toISOString().slice(0, 10)}.json"`);
      return res.end(JSON.stringify(backup, null, 2));
    }

    if (pathname === '/api/system/validate' && req.method === 'GET') {
      const [missingFiles] = await pool.query('SELECT id, raw_files FROM materials WHERE archived_at IS NULL');
      const issues = [];
      for (const material of missingFiles) {
        for (const file of safeJson(material.raw_files, [])) {
          try {
            await fs.access(path.join(projectRoot, file.source));
          } catch {
            issues.push({ type: 'missing_file', materialId: material.id, source: file.source });
          }
        }
      }
      const [orphanFindings] = await pool.query(
        `SELECT mf.id, mf.material_id FROM material_findings mf
         LEFT JOIN materials m ON m.id = mf.material_id WHERE m.id IS NULL`
      );
      issues.push(...orphanFindings.map((item) => ({ type: 'orphan_finding', ...item })));
      return sendJson(res, 200, {
        success: true,
        data: { passed: issues.length === 0, issues }
      });
    }

    return sendJson(res, 404, { success: false, message: `接口不存在：${pathname}` });
  } catch (error) {
    console.error(`[API] ${req.method} ${pathname}`, error);
    return sendJson(res, 500, {
      success: false,
      message: error.message,
      aiRunId: error.aiRunId || null
    });
  }
}

export function phase2ApiPlugin() {
  return {
    name: 'leo-phase2-api',
    configureServer(server) {
      server.middlewares.use(handleRequest);
      getPool().catch((error) => console.error('[API] 数据库初始化失败：', error.message));
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleRequest);
      getPool().catch((error) => console.error('[API] 数据库初始化失败：', error.message));
    }
  };
}

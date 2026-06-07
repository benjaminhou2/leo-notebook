import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeDatabase } from '../scripts/init-db.mjs';

const serverDir = path.dirname(fileURLToPath(import.meta.url));

export const siteRoot = path.resolve(serverDir, '..');
export const projectRoot = path.resolve(siteRoot, '..');

let dbPool = null;
let dbError = null;

export async function loadAuthConfig() {
  const configPath = path.join(projectRoot, 'config/auth.json');
  return JSON.parse(await fs.readFile(configPath, 'utf8'));
}

export async function getPool() {
  if (dbPool) return dbPool;
  if (dbError && Date.now() - dbError.time < 5000) throw dbError.error;
  try {
    const auth = await loadAuthConfig();
    if (!auth.mysql) throw new Error('缺少 MySQL 配置。');
    dbPool = await initializeDatabase(auth.mysql);
    dbError = null;
    return dbPool;
  } catch (error) {
    dbError = { error, time: Date.now() };
    throw error;
  }
}

export function parseBody(req, maxBytes = 40 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (Buffer.byteLength(body) > maxBytes) {
        reject(new Error('请求内容过大。'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('请求数据不是有效 JSON。'));
      }
    });
    req.on('error', reject);
  });
}

export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function safeJson(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function cleanFileName(value) {
  return String(value || '未命名')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function hashBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function hashText(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

export function decodeDataUrl(value) {
  const match = String(value || '').match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error('文件内容格式不正确。');
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64')
  };
}

export function subjectLabel(subject) {
  return subject === 'chinese' ? '语文' : subject === 'math' ? '数学' : subject === 'english' ? '英文' : '综合';
}

export function subjectDirectory(subject) {
  return subject === 'chinese'
    ? '语文/原始素材/'
    : subject === 'math'
      ? '数学/原始素材/'
      : '英文/原始素材/';
}

export function normalizeStatus(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function stripCodeFence(value) {
  return String(value || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export async function audit(pool, entityType, entityId, action, detail = {}) {
  await pool.query(
    'INSERT INTO audit_logs (entity_type, entity_id, action, detail) VALUES (?, ?, ?, ?)',
    [entityType, String(entityId), action, JSON.stringify(detail)]
  );
}

export function materialRow(row) {
  return {
    id: row.id,
    subject: row.subject,
    date: row.date,
    type: row.type,
    title: row.title,
    priority: row.priority,
    score: row.score,
    summary: row.summary,
    status: row.status,
    grade: row.grade,
    semester: row.semester,
    textbookVersion: row.textbook_version,
    unitName: row.unit_name || '',
    hasAnswers: Boolean(row.has_answers),
    hasTeacherMarks: Boolean(row.has_teacher_marks),
    analysisStatus: row.analysis_status,
    analysisConfidence: Number(row.analysis_confidence || 0),
    processingError: row.processing_error || '',
    rawFiles: safeJson(row.raw_files, []),
    analysis: {
      file: row.analysis_file || '',
      summary: row.analysis_summary || '',
      strengths: safeJson(row.analysis_strengths, []),
      needsImprovement: safeJson(row.analysis_needs_improvement, [])
    },
    learningLinks: safeJson(row.learning_links, []),
    provenance: {
      skillSlug: row.skill_slug || '',
      skillVersion: row.skill_version,
      promptSlug: row.prompt_slug || '',
      promptVersion: row.prompt_version,
      modelKey: row.model_key || '',
      aiRunId: row.ai_run_id
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function knowledgeRow(row) {
  return {
    id: row.id,
    subject: row.subject,
    priority: row.priority,
    title: row.title,
    reason: row.reason,
    goal: row.goal,
    catalogCode: row.catalog_code || '',
    status: row.status || 'new',
    masteryScore: Number(row.mastery_score || 0),
    confidenceScore: Number(row.confidence_score || 0),
    occurrenceCount: Number(row.occurrence_count || 1),
    nextReviewAt: row.next_review_at,
    lastEvidenceAt: row.last_evidence_at,
    grade: row.grade,
    semester: row.semester,
    textbookVersion: row.textbook_version,
    checkpoints: safeJson(row.checkpoints, []),
    practiceFiles: safeJson(row.practice_files, []),
    evidenceMaterialIds: safeJson(row.evidence_material_ids, []),
    latestQuiz: row.latest_score === null || row.latest_score === undefined
      ? null
      : {
          score: Number(row.latest_score),
          round: Number(row.latest_round),
          completedAt: row.latest_completed_at
        }
  };
}

export function promptVariables(content) {
  return [...String(content).matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)]
    .map((match) => match[1])
    .filter((value, index, values) => values.indexOf(value) === index);
}

export async function closePool() {
  if (dbPool) {
    await dbPool.end();
    dbPool = null;
  }
}

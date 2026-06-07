import { hashText } from './core.mjs';

const GENERIC_DISTRACTORS = new Set([
  '随便选',
  '完全不管',
  '以上都不对',
  '不知道',
  '无法判断',
  '不确定'
]);

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。！？；：,.!?;:'"“”‘’（）()【】\[\]]/g, '');
}

function bigrams(value) {
  const normalized = normalize(value);
  const result = new Set();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    result.add(normalized.slice(index, index + 2));
  }
  return result;
}

export function similarity(left, right) {
  const a = bigrams(left);
  const b = bigrams(right);
  if (!a.size || !b.size) return normalize(left) === normalize(right) ? 1 : 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return intersection / (a.size + b.size - intersection);
}

export function semanticHash(question) {
  return hashText(`${normalize(question.prompt)}|${(question.options || []).map(normalize).sort().join('|')}`);
}

function inspectQuestion(question, index) {
  const issues = [];
  const type = question.type;
  const options = Array.isArray(question.options) ? question.options.filter(Boolean) : [];
  const answers = Array.isArray(question.answers) ? question.answers.filter(Boolean) : [];

  if (!['choice', 'fill', 'judge'].includes(type)) {
    issues.push({ questionIndex: index + 1, type: 'structure', message: '题型不受支持。', action: 'regenerate' });
  }
  if (!String(question.prompt || '').trim()) {
    issues.push({ questionIndex: index + 1, type: 'structure', message: '题干为空。', action: 'regenerate' });
  }
  if (!answers.length) {
    issues.push({ questionIndex: index + 1, type: 'answer', message: '缺少正确答案。', action: 'regenerate' });
  }
  if (!String(question.explanation || '').trim()) {
    issues.push({ questionIndex: index + 1, type: 'answer', message: '缺少解析。', action: 'edit' });
  }
  if (!String(question.tag || '').trim()) {
    issues.push({ questionIndex: index + 1, type: 'content', message: '缺少细分知识点标签。', action: 'edit' });
  }
  if (!String(question.sourceBasis || '').trim()) {
    issues.push({ questionIndex: index + 1, type: 'content', message: '缺少来源或变式依据。', action: 'edit' });
  }

  if (type === 'choice') {
    const unique = [...new Set(options.map((option) => normalize(option)))];
    if (options.length !== 4 || unique.length !== 4) {
      issues.push({ questionIndex: index + 1, type: 'option', message: '选择题必须有四个不同选项。', action: 'regenerate' });
    }
    const matchingAnswers = options.filter((option) =>
      answers.some((answer) => normalize(answer) === normalize(option))
    );
    if (matchingAnswers.length !== 1) {
      issues.push({ questionIndex: index + 1, type: 'answer', message: '选择题必须有且只有一个答案与选项完全一致。', action: 'regenerate' });
    }
    const genericCount = options.filter((option) => GENERIC_DISTRACTORS.has(String(option).trim())).length;
    if (genericCount > 0) {
      issues.push({ questionIndex: index + 1, type: 'option', message: '包含敷衍或无教学价值的选项。', action: 'regenerate' });
    }
    const lengths = options.map((option) => String(option).length);
    const max = Math.max(...lengths);
    const min = Math.min(...lengths);
    if (max > Math.max(12, min * 3)) {
      issues.push({ questionIndex: index + 1, type: 'option', message: '选项长度差异过大，可能泄露答案。', action: 'edit' });
    }
  }

  if (type === 'judge' && answers.length !== 1) {
    issues.push({ questionIndex: index + 1, type: 'answer', message: '判断题只能有一个正确答案。', action: 'regenerate' });
  }

  return issues;
}

export function reviewQuestions(questions, existingQuestions = [], round = 1) {
  const issues = [];
  const exactHashes = new Map();
  let duplicatePairs = 0;
  let comparisonCount = 0;

  questions.forEach((question, index) => {
    issues.push(...inspectQuestion(question, index));
    const hash = semanticHash(question);
    if (exactHashes.has(hash)) {
      issues.push({
        questionIndex: index + 1,
        type: 'duplicate',
        message: `与本轮第 ${exactHashes.get(hash) + 1} 题完全重复。`,
        action: 'regenerate'
      });
    } else {
      exactHashes.set(hash, index);
    }
  });

  for (let leftIndex = 0; leftIndex < questions.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < questions.length; rightIndex += 1) {
      comparisonCount += 1;
      const score = similarity(questions[leftIndex].prompt, questions[rightIndex].prompt);
      if (score >= 0.82) {
        duplicatePairs += 1;
        issues.push({
          questionIndex: rightIndex + 1,
          type: 'duplicate',
          message: `与本轮第 ${leftIndex + 1} 题语义高度相似。`,
          action: 'regenerate'
        });
      }
    }
  }

  if (round === 2) {
    questions.forEach((question, index) => {
      const maximum = existingQuestions.reduce(
        (current, existing) => Math.max(current, similarity(question.prompt, existing.prompt)),
        0
      );
      if (maximum >= 0.82) {
        duplicatePairs += 1;
        comparisonCount += 1;
        issues.push({
          questionIndex: index + 1,
          type: 'duplicate',
          message: '与第一轮题目语义高度相似。',
          action: 'regenerate'
        });
      }
    });
  }

  const duplicateRate = comparisonCount ? (duplicatePairs / comparisonCount) * 100 : 0;
  const uniqueIssues = issues.filter((issue, index, values) =>
    values.findIndex((candidate) =>
      candidate.questionIndex === issue.questionIndex
      && candidate.type === issue.type
      && candidate.message === issue.message
    ) === index
  );
  const critical = uniqueIssues.filter((issue) => issue.action === 'regenerate').length;
  const score = Math.max(0, 100 - critical * 12 - (uniqueIssues.length - critical) * 5);

  return {
    passed: critical === 0 && duplicateRate <= 10,
    score,
    duplicateRate: Number(duplicateRate.toFixed(2)),
    issues: uniqueIssues
  };
}

export async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.message || `请求失败：${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload?.data ?? payload;
}

export function materialUrl(source) {
  return `/materials/${String(source || '').split('/').map(encodeURIComponent).join('/')}`;
}

export function formatDate(value, includeTime = false) {
  if (!value) return '未设置';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {})
  }).format(date);
}

export function subjectName(subject) {
  return subject === 'chinese' ? '语文' : subject === 'math' ? '数学' : subject === 'english' ? '英文' : '综合';
}

export function statusName(status) {
  const names = {
    pending_processing: '待处理',
    pending_analysis: '待分析',
    analyzing: '分析中',
    pending_review: '待确认',
    confirmed: '已确认',
    analysis_failed: '分析失败',
    processing_failed: '处理失败',
    not_started: '未开始',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    new: '新问题',
    persistent: '持续问题',
    improving: '正在改善',
    mastered: '已基本掌握',
    pending: '待学习',
    in_progress: '进行中',
    draft: '草稿',
    published: '已发布',
    enabled: '已启用',
    disabled: '已停用',
    archived: '已归档',
    accepted: '已确认',
    rejected: '已驳回',
    needs_review: '需复核原卷',
    healthy: '可用',
    error: '异常',
    unknown: '未检测'
  };
  return names[status] || status || '未知';
}

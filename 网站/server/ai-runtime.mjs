import { loadAuthConfig, promptVariables, safeJson, stripCodeFence, subjectLabel } from './core.mjs';

function renderTemplate(template, variables) {
  return String(template).replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    const value = variables[key];
    if (value === null || value === undefined) return '';
    return typeof value === 'string' ? value : JSON.stringify(value);
  });
}

async function resolveRoute(pool, taskType, subject = '*', materialType = '*') {
  const [rows] = await pool.query(
    `SELECT * FROM task_routes
     WHERE task_type = ? AND enabled = 1
       AND subject IN (?, '*')
       AND material_type IN (?, '*')
     ORDER BY
       CASE WHEN subject = ? THEN 0 ELSE 1 END,
       CASE WHEN material_type = ? THEN 0 ELSE 1 END
     LIMIT 1`,
    [taskType, subject, materialType, subject, materialType]
  );
  if (!rows.length) throw new Error(`没有找到任务路由：${taskType}/${subject}/${materialType}`);
  return rows[0];
}

async function resolveRuntime(pool, route) {
  const [[skill]] = await pool.query(
    `SELECT s.slug, s.name, s.description, s.active_version, sv.content
     FROM skills s
     JOIN skill_versions sv ON sv.skill_slug = s.slug AND sv.version = s.active_version
     WHERE s.slug = ? AND s.status = 'enabled'`,
    [route.skill_slug]
  );
  if (!skill) throw new Error(`技能不可用：${route.skill_slug}`);

  const [[prompt]] = await pool.query(
    `SELECT p.slug, p.name, p.active_version, pv.content, pv.variables
     FROM prompt_templates p
     JOIN prompt_versions pv ON pv.prompt_slug = p.slug AND pv.version = p.active_version
     WHERE p.slug = ? AND p.status = 'enabled'`,
    [route.prompt_slug]
  );
  if (!prompt) throw new Error(`提示词不可用：${route.prompt_slug}`);

  const [[model]] = await pool.query(
    'SELECT * FROM model_configs WHERE model_key = ? AND enabled = 1',
    [route.model_key]
  );
  if (!model) throw new Error(`模型不可用：${route.model_key}`);

  return { skill, prompt, model };
}

function parseModelJson(content) {
  const parsed = JSON.parse(stripCodeFence(content));
  if (!parsed || typeof parsed !== 'object') throw new Error('模型没有返回有效 JSON 对象。');
  return parsed;
}

async function callProvider(model, auth, messages) {
  const apiKey = auth[model.key_ref];
  if (!apiKey) throw new Error(`${model.name} 未配置访问密钥。`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(model.timeout_seconds || 90) * 1000);
  try {
    if (model.provider === 'zhipu') {
      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: model.model_name,
          messages,
          response_format: { type: 'json_object' },
          temperature: Number(model.temperature)
        })
      });
      if (!response.ok) throw new Error(`智谱接口返回 ${response.status}。`);
      const payload = await response.json();
      return parseModelJson(payload.choices?.[0]?.message?.content);
    }

    if (model.provider === 'deepseek') {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: model.model_name,
          messages,
          response_format: { type: 'json_object' },
          temperature: Number(model.temperature)
        })
      });
      if (!response.ok) throw new Error(`DeepSeek 接口返回 ${response.status}。`);
      const payload = await response.json();
      return parseModelJson(payload.choices?.[0]?.message?.content);
    }

    throw new Error(`暂不支持模型服务商：${model.provider}`);
  } finally {
    clearTimeout(timer);
  }
}

function buildMessages(runtime, variables, files = []) {
  const taskPrompt = renderTemplate(runtime.prompt.content, {
    subjectLabel: subjectLabel(variables.subject),
    ...variables
  });
  const systemContent = `${runtime.skill.content}\n\n# 当前任务\n${taskPrompt}`;
  const visibleVariables = Object.fromEntries(
    Object.entries(variables).filter(([key]) => !['subject'].includes(key))
  );
  const userText = `请处理以下任务输入，并严格返回提示词要求的 JSON。\n${JSON.stringify(visibleVariables, null, 2)}`;

  if (runtime.model.provider === 'zhipu' && files.length) {
    const content = [{ type: 'text', text: userText }];
    files
      .filter((file) => file.base64 && String(file.type || '').startsWith('image/'))
      .forEach((file) => {
        content.push({ type: 'image_url', image_url: { url: file.base64 } });
      });
    return [
      { role: 'system', content: systemContent },
      { role: 'user', content }
    ];
  }

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userText }
  ];
}

async function markModel(pool, modelKey, status, errorMessage = '') {
  await pool.query(
    `UPDATE model_configs
     SET last_status = ?, last_error = ?, last_checked_at = NOW()
     WHERE model_key = ?`,
    [status, errorMessage, modelKey]
  );
}

export async function runAiTask({
  pool,
  taskType,
  subject = '*',
  materialType = '*',
  variables = {},
  files = [],
  materialId = null,
  pointId = null,
  retryOf = null
}) {
  const route = await resolveRoute(pool, taskType, subject, materialType);
  const runtime = await resolveRuntime(pool, route);
  const auth = await loadAuthConfig();
  const startedAt = Date.now();

  const [runResult] = await pool.query(
    `INSERT INTO ai_runs
      (task_type, subject, material_id, point_id, skill_slug, skill_version,
       prompt_slug, prompt_version, model_key, status, input_summary, retry_of)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'running', ?, ?)`,
    [
      taskType,
      subject,
      materialId,
      pointId,
      runtime.skill.slug,
      runtime.skill.active_version,
      runtime.prompt.slug,
      runtime.prompt.active_version,
      runtime.model.model_key,
      JSON.stringify({
        variables: promptVariables(runtime.prompt.content),
        materialType,
        fileCount: files.length
      }),
      retryOf
    ]
  );
  const runId = runResult.insertId;

  try {
    const output = await callProvider(runtime.model, auth, buildMessages(runtime, variables, files));
    await pool.query(
      `UPDATE ai_runs
       SET status = 'completed', output_summary = ?, duration_ms = ?, completed_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(output).slice(0, 12000), Date.now() - startedAt, runId]
    );
    await markModel(pool, runtime.model.model_key, 'healthy');
    return {
      output,
      runId,
      provenance: {
        routeKey: route.route_key,
        skillSlug: runtime.skill.slug,
        skillVersion: runtime.skill.active_version,
        promptSlug: runtime.prompt.slug,
        promptVersion: runtime.prompt.active_version,
        modelKey: runtime.model.model_key
      }
    };
  } catch (primaryError) {
    await markModel(pool, runtime.model.model_key, 'error', primaryError.message);
    if (route.fallback_model_key) {
      const [[fallbackModel]] = await pool.query(
        'SELECT * FROM model_configs WHERE model_key = ? AND enabled = 1',
        [route.fallback_model_key]
      );
      if (fallbackModel) {
        try {
          const fallbackRuntime = { ...runtime, model: fallbackModel };
          const output = await callProvider(fallbackModel, auth, buildMessages(fallbackRuntime, variables, []));
          await pool.query(
            `UPDATE ai_runs
             SET status = 'completed', model_key = ?, output_summary = ?, duration_ms = ?, completed_at = NOW()
             WHERE id = ?`,
            [fallbackModel.model_key, JSON.stringify(output).slice(0, 12000), Date.now() - startedAt, runId]
          );
          await markModel(pool, fallbackModel.model_key, 'healthy');
          return {
            output,
            runId,
            provenance: {
              routeKey: route.route_key,
              skillSlug: runtime.skill.slug,
              skillVersion: runtime.skill.active_version,
              promptSlug: runtime.prompt.slug,
              promptVersion: runtime.prompt.active_version,
              modelKey: fallbackModel.model_key
            }
          };
        } catch (fallbackError) {
          await markModel(pool, fallbackModel.model_key, 'error', fallbackError.message);
          primaryError.message = `${primaryError.message}；备用模型失败：${fallbackError.message}`;
        }
      }
    }

    await pool.query(
      `UPDATE ai_runs
       SET status = 'failed', error_message = ?, duration_ms = ?, completed_at = NOW()
       WHERE id = ?`,
      [primaryError.message, Date.now() - startedAt, runId]
    );
    primaryError.aiRunId = runId;
    throw primaryError;
  }
}

export async function retryAiRun(pool, runId) {
  const [[run]] = await pool.query('SELECT * FROM ai_runs WHERE id = ?', [runId]);
  if (!run) throw new Error('找不到需要重试的智能运行记录。');
  const variables = safeJson(run.input_summary, {});
  return runAiTask({
    pool,
    taskType: run.task_type,
    subject: run.subject || '*',
    variables: variables.variables || {},
    materialId: run.material_id,
    pointId: run.point_id,
    retryOf: run.id
  });
}

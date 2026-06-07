import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  DatabaseBackup,
  Download,
  FileCode2,
  GitBranch,
  PlayCircle,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { api, formatDate, statusName } from '../../api.js';
import {
  Button,
  Drawer,
  EmptyState,
  ErrorNotice,
  Field,
  Loading,
  Notice,
  PageHeading,
  Segmented,
  Status
} from '../../components/Common.jsx';

const tabs = [
  { value: 'skills', label: '技能' },
  { value: 'prompts', label: '提示词' },
  { value: 'models', label: '模型' },
  { value: 'routes', label: '任务路由' },
  { value: 'runs', label: '运行记录' },
  { value: 'system', label: '数据维护' }
];

function VersionEditor({ type, item, onClose, onChanged }) {
  const slug = item.slug;
  const [detail, setDetail] = useState(null);
  const [content, setContent] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const data = await api(`/api/config/${type}/${slug}`);
      setDetail(data);
      setContent(data.active_content || '');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  useEffect(() => { load(); }, [slug]);

  async function saveDraft() {
    setBusy(true);
    try {
      const result = await api(`/api/config/${type}/${slug}`, {
        method: 'POST',
        body: JSON.stringify({ content, changeNote })
      });
      await load();
      await onChanged();
      setChangeNote(`已保存 v${result.version} 草稿`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function versionAction(action, version) {
    setBusy(true);
    try {
      await api(`/api/config/${type}/${slug}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ version })
      });
      await load();
      await onChanged();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      title={`${type === 'skills' ? '技能' : '提示词'}：${item.name}`}
      onClose={onClose}
      footer={<Button icon={Save} onClick={saveDraft} disabled={busy}>保存为新草稿</Button>}
    >
      <ErrorNotice message={error} />
      {!detail ? <Loading /> : (
        <div className="form-stack">
          <Notice>当前生效版本为 v{detail.active_version}。保存会新建草稿，不会立刻影响分析任务。</Notice>
          <Field label="版本内容">
            <textarea className="code-editor" rows="24" value={content} onChange={(event) => setContent(event.target.value)} />
          </Field>
          <Field label="变更说明"><input value={changeNote} onChange={(event) => setChangeNote(event.target.value)} placeholder="说明本次修改解决什么问题" /></Field>
          <div className="version-list">
            <strong>版本记录</strong>
            {detail.versions.map((version) => (
              <div key={version.id}>
                <span><b>v{version.version}</b><Status value={version.status} /></span>
                <small>{version.change_note || version.test_note || '无说明'} · {formatDate(version.created_at, true)}</small>
                <span className="version-actions">
                  {version.status === 'draft' ? <Button size="sm" icon={PlayCircle} onClick={() => versionAction('publish', version.version)}>发布</Button> : null}
                  {version.version !== detail.active_version ? <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => versionAction('rollback', version.version)}>回退到此版</Button> : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Models({ items, onChanged }) {
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  async function save() {
    try {
      await api(`/api/config/models/${editing.model_key}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editing.name,
          modelName: editing.model_name,
          purpose: editing.purpose,
          temperature: editing.temperature,
          timeoutSeconds: editing.timeout_seconds,
          retryCount: editing.retry_count,
          enabled: Boolean(editing.enabled)
        })
      });
      setEditing(null);
      onChanged();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <>
      <ErrorNotice message={error} />
      <div className="config-cards">
        {items.map((model) => (
          <button type="button" key={model.model_key} onClick={() => setEditing({ ...model })}>
            <span><Bot size={20} /><Status value={model.enabled ? 'enabled' : 'disabled'} /></span>
            <strong>{model.name}</strong><small>{model.provider} · {model.model_name}</small>
            <p>{model.purpose}</p>
            <span className="config-meta"><Status value={model.last_status} /><b>{model.keyConfigured ? '密钥已配置' : '密钥未配置'}</b></span>
          </button>
        ))}
      </div>
      {editing ? (
        <Drawer title={`模型配置：${editing.name}`} onClose={() => setEditing(null)} footer={<Button icon={Save} onClick={save}>保存配置</Button>}>
          <div className="form-stack">
            <Field label="显示名称"><input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></Field>
            <Field label="模型名称"><input value={editing.model_name} onChange={(event) => setEditing({ ...editing, model_name: event.target.value })} /></Field>
            <Field label="用途"><textarea rows="3" value={editing.purpose} onChange={(event) => setEditing({ ...editing, purpose: event.target.value })} /></Field>
            <div className="form-grid form-grid-3">
              <Field label="温度"><input type="number" step="0.1" min="0" max="2" value={editing.temperature} onChange={(event) => setEditing({ ...editing, temperature: event.target.value })} /></Field>
              <Field label="超时秒数"><input type="number" min="10" value={editing.timeout_seconds} onChange={(event) => setEditing({ ...editing, timeout_seconds: event.target.value })} /></Field>
              <Field label="重试次数"><input type="number" min="0" max="3" value={editing.retry_count} onChange={(event) => setEditing({ ...editing, retry_count: event.target.value })} /></Field>
            </div>
            <label className="check-line"><input type="checkbox" checked={Boolean(editing.enabled)} onChange={(event) => setEditing({ ...editing, enabled: event.target.checked })} /> 启用此模型</label>
          </div>
        </Drawer>
      ) : null}
    </>
  );
}

function Routes({ items, skills, prompts, models, onChanged }) {
  const [editing, setEditing] = useState(null);
  async function save() {
    await api(`/api/config/routes/${editing.route_key}`, {
      method: 'PATCH',
      body: JSON.stringify({
        skillSlug: editing.skill_slug,
        promptSlug: editing.prompt_slug,
        modelKey: editing.model_key,
        fallbackModelKey: editing.fallback_model_key,
        enabled: Boolean(editing.enabled)
      })
    });
    setEditing(null);
    onChanged();
  }

  return (
    <>
      <div className="data-table route-table">
        <div className="data-table-head"><span>任务</span><span>科目/素材</span><span>技能</span><span>提示词</span><span>主模型</span><span>状态</span></div>
        {items.map((route) => <button type="button" className="data-table-row" key={route.route_key} onClick={() => setEditing({ ...route })}><span className="table-primary"><strong>{route.task_type}</strong><small>{route.route_key}</small></span><span>{route.subject} / {route.material_type}</span><span>{route.skill_slug}</span><span>{route.prompt_slug}</span><span>{route.model_key}</span><span><Status value={route.enabled ? 'enabled' : 'disabled'} /></span></button>)}
      </div>
      {editing ? (
        <Drawer title={`任务路由：${editing.task_type}`} onClose={() => setEditing(null)} footer={<Button icon={Save} onClick={save}>保存路由</Button>}>
          <div className="form-stack">
            <Notice>路由决定每种智能任务使用哪个技能、提示词和模型。</Notice>
            <Field label="技能"><select value={editing.skill_slug} onChange={(event) => setEditing({ ...editing, skill_slug: event.target.value })}>{skills.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></Field>
            <Field label="提示词"><select value={editing.prompt_slug} onChange={(event) => setEditing({ ...editing, prompt_slug: event.target.value })}>{prompts.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></Field>
            <Field label="主模型"><select value={editing.model_key} onChange={(event) => setEditing({ ...editing, model_key: event.target.value })}>{models.map((item) => <option key={item.model_key} value={item.model_key}>{item.name}</option>)}</select></Field>
            <Field label="备用模型"><select value={editing.fallback_model_key || ''} onChange={(event) => setEditing({ ...editing, fallback_model_key: event.target.value })}><option value="">不设置</option>{models.map((item) => <option key={item.model_key} value={item.model_key}>{item.name}</option>)}</select></Field>
            <label className="check-line"><input type="checkbox" checked={Boolean(editing.enabled)} onChange={(event) => setEditing({ ...editing, enabled: event.target.checked })} /> 启用路由</label>
          </div>
        </Drawer>
      ) : null}
    </>
  );
}

function SystemPanel() {
  const [validation, setValidation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function validate() {
    setBusy(true);
    try {
      setValidation(await api('/api/system/validate'));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="system-panel">
      <ErrorNotice message={error} />
      <section className="work-section"><div className="section-title-row"><div><h2>一致性检查</h2><p>检查原始文件缺失和数据库孤立记录。</p></div><Button icon={ShieldCheck} onClick={validate} disabled={busy}>{busy ? '检查中...' : '开始检查'}</Button></div>
        {validation ? validation.passed ? <Notice tone="success">数据与本地原始文件检查通过。</Notice> : <div className="issue-list">{validation.issues.map((issue, index) => <div key={`${issue.type}-${index}`}><Status value="error" /><span><strong>{issue.type === 'missing_file' ? '原始文件缺失' : '孤立记录'}</strong><small>{issue.source || issue.materialId || issue.id}</small></span></div>)}</div> : <Notice>检查只读取文件和数据库，不会自动删除或修改资料。</Notice>}
      </section>
      <section className="work-section"><div className="section-title-row"><div><h2>完整备份</h2><p>导出业务数据、技能版本、提示词版本和运行记录。</p></div><a className="button button-secondary button-md" href="/api/system/backup" download><Download size={17} /><span>下载 JSON 备份</span></a></div></section>
    </div>
  );
}

export default function ConfigPage({ initialState, clearInitialState }) {
  const [tab, setTab] = useState(initialState?.configTab || 'skills');
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [editing, setEditing] = useState(null);

  async function load() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      setState({ loading: false, data: await api('/api/config'), error: '' });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (initialState?.configTab) {
      setTab(initialState.configTab);
      clearInitialState?.();
    }
  }, [initialState]);

  const icon = useMemo(() => ({ skills: Sparkles, prompts: FileCode2, models: Bot, routes: GitBranch, runs: Activity, system: DatabaseBackup })[tab], [tab]);
  const Icon = icon;
  const data = state.data;
  return (
    <div className="page">
      <PageHeading title="智能配置" detail="集中维护技能、提示词、模型和任务路由；所有智能运行保留版本来源。" actions={<Button icon={Settings2} variant="secondary" onClick={load}>刷新配置</Button>} />
      <ErrorNotice message={state.error} onRetry={load} />
      <div className="config-tabs"><Segmented value={tab} onChange={setTab} ariaLabel="配置模块" options={tabs} /></div>
      {state.loading && !data ? <Loading label="正在读取智能配置..." /> : data ? (
        <section className="config-content">
          <div className="config-title"><Icon size={20} /><strong>{tabs.find((item) => item.value === tab)?.label}</strong></div>
          {tab === 'skills' ? <div className="config-cards">{data.skills.map((item) => <button type="button" key={item.slug} onClick={() => setEditing({ type: 'skills', item })}><span><Sparkles size={20} /><Status value={item.status} /></span><strong>{item.name}</strong><small>{item.subject} · v{item.active_version}</small><p>{item.description}</p></button>)}</div> : null}
          {tab === 'prompts' ? <div className="config-cards">{data.prompts.map((item) => <button type="button" key={item.slug} onClick={() => setEditing({ type: 'prompts', item })}><span><FileCode2 size={20} /><Status value={item.status} /></span><strong>{item.name}</strong><small>{item.task_type} · v{item.active_version}</small><p>{item.description}</p></button>)}</div> : null}
          {tab === 'models' ? <Models items={data.models} onChanged={load} /> : null}
          {tab === 'routes' ? <Routes items={data.routes} skills={data.skills} prompts={data.prompts} models={data.models} onChanged={load} /> : null}
          {tab === 'runs' ? (
            data.runs.length ? <div className="data-table runs-table"><div className="data-table-head"><span>任务</span><span>来源</span><span>模型</span><span>状态</span><span>耗时</span><span>时间</span></div>{data.runs.map((run) => <div className="data-table-row" key={run.id}><span className="table-primary"><strong>{run.task_type}</strong><small>运行 #{run.id}</small></span><span>{run.skill_slug || '–'} v{run.skill_version || '–'}</span><span>{run.model_key || '–'}</span><span><Status value={run.status} /></span><span>{run.duration_ms ? `${run.duration_ms} ms` : '–'}</span><span>{formatDate(run.created_at, true)}{run.error_message ? <small title={run.error_message}>{run.error_message}</small> : null}</span></div>)}</div> : <EmptyState title="还没有模型运行记录" />
          ) : null}
          {tab === 'system' ? <SystemPanel /> : null}
        </section>
      ) : null}
      {editing ? <VersionEditor type={editing.type} item={editing.item} onClose={() => setEditing(null)} onChanged={load} /> : null}
    </div>
  );
}

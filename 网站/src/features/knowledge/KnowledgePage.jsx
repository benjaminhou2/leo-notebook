import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BookOpen,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  Edit3,
  Filter,
  History,
  Plus,
  Save,
  Search
} from 'lucide-react';
import { api, formatDate, subjectName } from '../../api.js';
import {
  Button,
  Drawer,
  EmptyState,
  ErrorNotice,
  Field,
  Loading,
  PageHeading,
  Progress,
  Status,
  SubjectMark
} from '../../components/Common.jsx';

function PointEditor({ point, catalog, onClose, onSaved }) {
  const [draft, setDraft] = useState(point);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api(`/api/knowledge-points/${point.id}`, {
        method: 'PATCH',
        body: JSON.stringify(draft)
      });
      await onSaved();
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      title="编辑知识画像"
      onClose={onClose}
      footer={<Button icon={Save} onClick={save} disabled={busy}>{busy ? '保存中...' : '保存修改'}</Button>}
    >
      <ErrorNotice message={error} />
      <div className="form-stack">
        <div className="form-grid form-grid-2">
          <Field label="优先级">
            <select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}>
              <option value="P0">P0 高</option>
              <option value="P1">P1 中</option>
              <option value="P2">P2 低</option>
            </select>
          </Field>
          <Field label="状态">
            <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
              <option value="new">新问题</option>
              <option value="persistent">持续问题</option>
              <option value="improving">正在改善</option>
              <option value="mastered">已基本掌握</option>
            </select>
          </Field>
        </div>
        <Field label="薄弱点名称"><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
        <Field label="知识目录">
          <select value={draft.catalogCode || ''} onChange={(event) => setDraft({ ...draft, catalogCode: event.target.value })}>
            <option value="">暂不关联目录</option>
            {catalog.filter((item) => item.subject === point.subject).map((item) => (
              <option key={item.code} value={item.code}>{item.unit_name} · {item.title}</option>
            ))}
          </select>
        </Field>
        <Field label="问题判断"><textarea rows="3" value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} /></Field>
        <Field label="掌握目标"><textarea rows="3" value={draft.goal} onChange={(event) => setDraft({ ...draft, goal: event.target.value })} /></Field>
        <div className="form-grid form-grid-2">
          <Field label="掌握度"><input type="number" min="0" max="100" value={draft.masteryScore} onChange={(event) => setDraft({ ...draft, masteryScore: event.target.value })} /></Field>
          <Field label="证据置信度"><input type="number" min="0" max="100" value={draft.confidenceScore} onChange={(event) => setDraft({ ...draft, confidenceScore: event.target.value })} /></Field>
        </div>
        <Field label="下次复习时间"><input type="datetime-local" value={draft.nextReviewAt ? String(draft.nextReviewAt).slice(0, 16) : ''} onChange={(event) => setDraft({ ...draft, nextReviewAt: event.target.value })} /></Field>
        <Field label="验收检查点" hint="每行一条">
          <textarea
            rows="4"
            value={(draft.checkpoints || []).join('\n')}
            onChange={(event) => setDraft({ ...draft, checkpoints: event.target.value.split('\n').filter(Boolean) })}
          />
        </Field>
      </div>
    </Drawer>
  );
}

function Timeline({ pointId }) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });

  useEffect(() => {
    api(`/api/knowledge-points/${pointId}/timeline`)
      .then((data) => setState({ loading: false, data, error: '' }))
      .catch((error) => setState({ loading: false, data: null, error: error.message }));
  }, [pointId]);

  if (state.loading) return <Loading label="正在整理证据时间线..." />;
  if (state.error) return <ErrorNotice message={state.error} />;

  const events = [
    ...state.data.findings.map((item) => ({
      id: `finding-${item.id}`,
      date: item.created_at,
      icon: BookOpen,
      title: item.material_title,
      detail: `${item.evidence_text || item.reason || '已确认学习证据'}`
    })),
    ...state.data.results.map((item) => ({
      id: `result-${item.id}`,
      date: item.completed_at,
      icon: ClipboardCheck,
      title: `第 ${item.round} 轮训练：${item.score} 分`,
      detail: '训练结果已用于更新掌握度。'
    })),
    ...state.data.snapshots.map((item) => ({
      id: `snapshot-${item.id}`,
      date: item.created_at,
      icon: Activity,
      title: `掌握度更新为 ${Math.round(Number(item.mastery_score || 0))}%`,
      detail: item.reason
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return events.length ? (
    <div className="timeline">
      {events.map((event) => {
        const Icon = event.icon;
        return (
          <div className="timeline-item" key={event.id}>
            <span className="timeline-icon"><Icon size={16} /></span>
            <div><strong>{event.title}</strong><p>{event.detail}</p><small>{formatDate(event.date, true)}</small></div>
          </div>
        );
      })}
    </div>
  ) : <EmptyState title="还没有形成证据时间线" detail="确认素材或完成训练后，这里会记录掌握度变化。" />;
}

export default function KnowledgePage({ initialState, clearInitialState, navigate }) {
  const [points, setPoints] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [filters, setFilters] = useState({ subject: 'all', status: 'all', q: '' });
  const [selectedId, setSelectedId] = useState(initialState?.pointId || null);
  const [editing, setEditing] = useState(null);
  const [state, setState] = useState({ loading: true, error: '' });

  async function load() {
    setState({ loading: true, error: '' });
    try {
      const params = new URLSearchParams();
      if (filters.subject !== 'all') params.set('subject', filters.subject);
      if (filters.status !== 'all') params.set('status', filters.status);
      const [pointRows, catalogRows] = await Promise.all([
        api(`/api/knowledge-points?${params}`),
        api('/api/knowledge/catalog')
      ]);
      setPoints(pointRows);
      setCatalog(catalogRows);
      setSelectedId((current) => current || pointRows[0]?.id || null);
      setState({ loading: false, error: '' });
    } catch (error) {
      setState({ loading: false, error: error.message });
    }
  }

  useEffect(() => {
    load();
  }, [filters.subject, filters.status]);

  useEffect(() => {
    if (initialState?.pointId) {
      setSelectedId(initialState.pointId);
      clearInitialState?.();
    }
  }, [initialState]);

  const visiblePoints = useMemo(() => {
    const query = filters.q.trim().toLowerCase();
    return query ? points.filter((point) => `${point.title}${point.reason}${point.goal}`.toLowerCase().includes(query)) : points;
  }, [points, filters.q]);
  const selected = points.find((point) => point.id === selectedId);

  return (
    <div className="page">
      <PageHeading
        title="知识画像"
        detail="用素材证据、训练表现和时间变化共同判断掌握情况。"
        actions={<Button icon={Plus} variant="secondary" onClick={() => navigate('materials')}>从新素材发现薄弱点</Button>}
      />
      <ErrorNotice message={state.error} onRetry={load} />
      <div className="filter-bar">
        <div className="search-field"><Search size={17} /><input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="搜索薄弱点、原因或目标" /></div>
        <div className="filter-select"><Filter size={16} /><select value={filters.subject} onChange={(event) => setFilters({ ...filters, subject: event.target.value })}><option value="all">全部科目</option><option value="chinese">语文</option><option value="math">数学</option><option value="english">英文</option></select></div>
        <div className="filter-select"><History size={16} /><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="all">全部状态</option><option value="new">新问题</option><option value="persistent">持续问题</option><option value="improving">正在改善</option><option value="mastered">已基本掌握</option></select></div>
        <span className="filter-count">{visiblePoints.length} 个知识点</span>
      </div>

      {state.loading ? <Loading label="正在读取知识画像..." /> : visiblePoints.length ? (
        <div className="knowledge-layout">
          <section className="knowledge-list">
            {visiblePoints.map((point) => (
              <button type="button" key={point.id} className={selectedId === point.id ? 'active' : ''} onClick={() => setSelectedId(point.id)}>
                <span className="knowledge-list-top"><SubjectMark subject={point.subject} compact /><b>{point.priority}</b><Status value={point.status} /></span>
                <strong>{point.title}</strong>
                <small>{point.reason}</small>
                <Progress value={point.masteryScore} tone={point.subject === 'math' ? 'sky' : point.subject === 'chinese' ? 'peach' : 'mint'} />
              </button>
            ))}
          </section>

          {selected ? (
            <section className="knowledge-detail">
              <div className="detail-heading">
                <div><span><SubjectMark subject={selected.subject} compact /><b>{selected.priority}</b><Status value={selected.status} /></span><h2>{selected.title}</h2><p>{selected.reason}</p></div>
                <Button icon={Edit3} variant="secondary" onClick={() => setEditing(selected)}>编辑</Button>
              </div>
              <div className="score-pair">
                <div><Progress value={selected.masteryScore} label="当前掌握度" tone="sky" /><small>根据训练得分动态更新</small></div>
                <div><Progress value={selected.confidenceScore} label="证据置信度" tone="mint" /><small>证据越完整，判断越可靠</small></div>
              </div>
              <div className="detail-grid">
                <div className="detail-block"><span>掌握目标</span><strong>{selected.goal || '尚未设置目标'}</strong></div>
                <div className="detail-block"><span>出现次数</span><strong>{selected.occurrenceCount} 次</strong></div>
                <div className="detail-block"><span>最近训练</span><strong>{selected.latestQuiz ? `第 ${selected.latestQuiz.round} 轮 ${selected.latestQuiz.score} 分` : '尚未训练'}</strong></div>
                <div className="detail-block"><span>下次复习</span><strong>{formatDate(selected.nextReviewAt)}</strong></div>
              </div>
              <div className="section-title-row compact-title">
                <div><h2>验收检查点</h2><p>用于判断是否真正掌握，而不只看一次分数。</p></div>
                <Button icon={ChevronRight} onClick={() => navigate('training', { pointId: selected.id })}>安排训练</Button>
              </div>
              {selected.checkpoints?.length ? <ul className="checkpoints">{selected.checkpoints.map((item) => <li key={item}>{item}</li>)}</ul> : <EmptyState title="尚未设置检查点" />}
              <div className="section-title-row compact-title"><div><h2>证据时间线</h2><p>素材确认、训练作答和掌握度快照。</p></div><span className="quiet-inline"><CalendarClock size={15} />最近更新 {formatDate(selected.lastEvidenceAt || selected.latestQuiz?.completedAt)}</span></div>
              <Timeline pointId={selected.id} />
            </section>
          ) : null}
        </div>
      ) : <EmptyState title="还没有知识画像" detail="完成一份素材的智能分析与人工确认后，系统会建立第一批薄弱点。" />}

      {editing ? <PointEditor point={editing} catalog={catalog} onClose={() => setEditing(null)} onSaved={load} /> : null}
    </div>
  );
}

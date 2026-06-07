import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  RefreshCw,
  TriangleAlert
} from 'lucide-react';
import { api, formatDate, statusName, subjectName } from '../../api.js';
import {
  Button,
  EmptyState,
  ErrorNotice,
  Loading,
  PageHeading,
  Progress,
  Status,
  SubjectMark
} from '../../components/Common.jsx';

function Metric({ label, value, detail, tone }) {
  return (
    <div className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function Trend({ rows }) {
  const values = rows.map((row) => Number(row.score || 0));
  const maximum = Math.max(100, ...values);
  const days = useMemo(() => {
    const map = new Map(rows.map((row) => [String(row.day).slice(0, 10), row]));
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date();
      day.setDate(day.getDate() - (6 - index));
      const key = day.toISOString().slice(0, 10);
      return { key, label: `${day.getMonth() + 1}/${day.getDate()}`, ...(map.get(key) || { score: 0, count: 0 }) };
    });
  }, [rows]);

  return (
    <div className="trend-chart" aria-label="最近七天训练得分趋势">
      {days.map((day) => (
        <div className="trend-column" key={day.key}>
          <div className="trend-value">{Number(day.score) ? Math.round(day.score) : '–'}</div>
          <div className="trend-bar-track">
            <span style={{ height: `${Math.max(4, (Number(day.score || 0) / maximum) * 100)}%` }} />
          </div>
          <small>{day.label}</small>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage({ navigate }) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });

  async function load() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await api('/api/dashboard');
      setState({ loading: false, data, error: '' });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (state.loading && !state.data) return <Loading label="正在整理 Leo 的学习工作台..." />;
  if (state.error && !state.data) return <ErrorNotice message={state.error} onRetry={load} />;

  const { stats, recentMaterials, priorityPoints, todayTasks, recentResults, reviewItems, trend } = state.data;
  const materialStats = stats.materials || {};
  const taskStats = stats.tasks || {};
  const knowledgeStats = stats.knowledge || {};

  return (
    <div className="page">
      <PageHeading
        title="学习工作台"
        detail="先处理待确认素材，再安排最重要的薄弱点训练。"
        actions={<Button icon={RefreshCw} variant="secondary" onClick={load}>刷新数据</Button>}
      />

      <section className="metric-row" aria-label="当前学习状态">
        <Metric label="待确认素材" value={Number(materialStats.pending_review || 0)} detail={`共 ${materialStats.total || 0} 份素材`} tone="peach" />
        <Metric label="P0 薄弱点" value={Number(knowledgeStats.p0 || 0)} detail={`${knowledgeStats.mastered || 0} 个已掌握`} tone="yellow" />
        <Metric label="待学习任务" value={Number(taskStats.pending || 0)} detail={`${taskStats.completed || 0} 个已完成`} tone="sky" />
        <Metric label="平均掌握度" value={`${Math.round(Number(knowledgeStats.average_mastery || 0))}%`} detail="综合素材与训练记录" tone="mint" />
      </section>

      <div className="dashboard-layout">
        <div className="dashboard-main">
          <section className="work-section">
            <div className="section-title-row">
              <div>
                <h2>今日待办</h2>
                <p>按优先级和到期时间排序。</p>
              </div>
              <Button variant="text" icon={ArrowRight} onClick={() => navigate('training')}>全部任务</Button>
            </div>
            {todayTasks.length ? (
              <div className="task-list">
                {todayTasks.slice(0, 5).map((task) => (
                  <button
                    type="button"
                    className="task-row"
                    key={task.id}
                    onClick={() => navigate(task.task_type === 'round1' || task.task_type === 'round2' ? 'training' : 'knowledge', { pointId: task.point_id })}
                  >
                    <span className={`task-type task-type-${task.task_type}`}>
                      {task.task_type === 'round1' ? <ClipboardCheck size={17} /> : task.task_type === 'round2' ? <BookOpenCheck size={17} /> : <RefreshCw size={17} />}
                    </span>
                    <span className="task-copy">
                      <strong>{task.title}</strong>
                      <small>{task.reason}</small>
                    </span>
                    <SubjectMark subject={task.subject} compact />
                    <span className="task-time">{task.estimated_minutes} 分钟</span>
                    <Status value={task.actionable ? task.status : 'draft'} />
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
            ) : <EmptyState title="今天没有待办任务" detail="新的素材确认后，系统会自动安排训练和复习。" />}
          </section>

          <div className="dashboard-two-column">
            <section className="work-section">
              <div className="section-title-row">
                <div>
                  <h2>素材处理队列</h2>
                  <p>查看分析状态和下一步操作。</p>
                </div>
                <Button variant="text" onClick={() => navigate('materials')}>素材中心</Button>
              </div>
              <div className="compact-list">
                {recentMaterials.map((material) => (
                  <button type="button" key={material.id} onClick={() => navigate('materials', { materialId: material.id })}>
                    <SubjectMark subject={material.subject} compact />
                    <span>
                      <strong>{material.title}</strong>
                      <small>{formatDate(material.date)} · {material.type}</small>
                    </span>
                    <Status value={material.analysis_status === 'completed' ? material.status : material.analysis_status} />
                    <ArrowRight size={15} />
                  </button>
                ))}
              </div>
            </section>

            <section className="work-section">
              <div className="section-title-row">
                <div>
                  <h2>P0 薄弱点</h2>
                  <p>优先看持续出现且掌握度较低的问题。</p>
                </div>
                <Button variant="text" onClick={() => navigate('knowledge')}>知识画像</Button>
              </div>
              <div className="knowledge-mini-list">
                {priorityPoints.filter((point) => point.priority === 'P0').slice(0, 5).map((point) => (
                  <button type="button" key={point.id} onClick={() => navigate('knowledge', { pointId: point.id })}>
                    <div>
                      <span><SubjectMark subject={point.subject} compact /><Status value={point.status || 'new'} /></span>
                      <strong>{point.title}</strong>
                      <small>{point.evidence_count || point.occurrence_count || 1} 条学习证据</small>
                    </div>
                    <Progress value={point.mastery_score} tone={point.subject === 'math' ? 'sky' : point.subject === 'chinese' ? 'peach' : 'mint'} />
                  </button>
                ))}
              </div>
            </section>
          </div>

          <section className="work-section">
            <div className="section-title-row">
              <div>
                <h2>最近七天训练趋势</h2>
                <p>只展示真实作答记录，没有训练的日期留空。</p>
              </div>
              <span className="section-summary">{recentResults.length} 条近期记录</span>
            </div>
            <Trend rows={trend || []} />
          </section>
        </div>

        <aside className="dashboard-rail">
          <section className="rail-section">
            <div className="rail-title">
              <BookOpenCheck size={18} />
              <h2>Leo 今日计划</h2>
            </div>
            <strong className="rail-number">
              {todayTasks.some((task) => task.actionable)
                ? `${todayTasks.filter((task) => task.actionable).reduce((sum, task) => sum + Number(task.estimated_minutes || 0), 0)} 分钟`
                : '尚未发布'}
            </strong>
            <p>{todayTasks.some((task) => task.actionable) ? '一次只抓最重要的 1-3 个任务。' : '训练题通过家长质检后才会出现在 Leo 端。'}</p>
            <Button className="full-width" onClick={() => navigate('today', {}, 'student')}>进入 Leo 端</Button>
          </section>

          <section className="rail-section">
            <div className="rail-title warning">
              <TriangleAlert size={18} />
              <h2>需复核原卷</h2>
            </div>
            {reviewItems.length ? (
              <div className="rail-list">
                {reviewItems.slice(0, 4).map((item) => (
                  <button type="button" key={`${item.item_type}-${item.id}`} onClick={() => navigate('materials', { materialId: item.material_id })}>
                    <strong>{item.title}</strong>
                    <span>{subjectName(item.subject)} · 置信度 {Math.round(Number(item.confidence || 0))}%</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rail-complete"><CheckCircle2 size={20} /><span>当前没有待复核内容</span></div>
            )}
          </section>

          <section className="rail-section">
            <div className="rail-title">
              <FileSearch size={18} />
              <h2>数据健康</h2>
            </div>
            <p>缺失文件、断链和失败任务可以在智能配置的数据维护中检查。</p>
            <Button variant="secondary" className="full-width" onClick={() => navigate('config', { configTab: 'system' })}>检查系统数据</Button>
          </section>
        </aside>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { BarChart3, FileText, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';
import { api, subjectName } from '../../api.js';
import {
  Button,
  EmptyState,
  ErrorNotice,
  Loading,
  Notice,
  PageHeading,
  Progress,
  Segmented,
  Status,
  SubjectMark
} from '../../components/Common.jsx';

function SubjectBars({ rows }) {
  const subjects = ['chinese', 'math', 'english'];
  return (
    <div className="subject-bars">
      {subjects.map((subject) => {
        const roundOne = rows.find((item) => item.subject === subject && Number(item.round) === 1);
        const roundTwo = rows.find((item) => item.subject === subject && Number(item.round) === 2);
        return (
          <div key={subject}>
            <SubjectMark subject={subject} compact />
            <Progress value={roundOne?.average_score || 0} label="第一轮平均分" tone={subject === 'math' ? 'sky' : subject === 'chinese' ? 'peach' : 'mint'} />
            <Progress value={roundTwo?.average_score || 0} label="第二轮平均分" tone="mint" />
          </div>
        );
      })}
    </div>
  );
}

export default function ReportsPage() {
  const [period, setPeriod] = useState('week');
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [narrative, setNarrative] = useState(null);
  const [provenance, setProvenance] = useState(null);
  const [generating, setGenerating] = useState(false);

  async function load() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await api(`/api/reports?period=${period}`);
      setState({ loading: false, data, error: '' });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }

  useEffect(() => {
    setNarrative(null);
    load();
  }, [period]);

  async function generateNarrative() {
    setGenerating(true);
    try {
      const result = await api('/api/reports/generate', {
        method: 'POST',
        body: JSON.stringify({ period, grade: '小学五年级', semester: '下学期' })
      });
      setNarrative(result.narrative);
      setProvenance(result.provenance);
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setGenerating(false);
    }
  }

  if (state.loading && !state.data) return <Loading label="正在汇总学习报告..." />;
  const data = state.data;
  const summary = data?.summary || {};

  return (
    <div className="page">
      <PageHeading
        title="学习报告"
        detail="按真实素材、训练结果与掌握度变化汇总，不用单次分数代替长期判断。"
        actions={(
          <>
            <Segmented value={period} onChange={setPeriod} ariaLabel="报告周期" options={[{ value: 'week', label: '最近 7 天' }, { value: 'month', label: '最近 30 天' }]} />
            <Button icon={RefreshCw} variant="secondary" onClick={load}>刷新</Button>
          </>
        )}
      />
      <ErrorNotice message={state.error} onRetry={load} />
      {data ? (
        <>
          <section className="metric-row report-metrics">
            <div className="metric metric-peach"><span>新增素材</span><strong>{summary.materials || 0}</strong><small>纳入本周期分析</small></div>
            <div className="metric metric-yellow"><span>确认诊断</span><strong>{summary.findings || 0}</strong><small>有证据支持的结论</small></div>
            <div className="metric metric-sky"><span>完成训练</span><strong>{summary.quizzes || 0}</strong><small>真实作答记录</small></div>
            <div className="metric metric-mint"><span>平均得分</span><strong>{summary.average_score ? `${Math.round(Number(summary.average_score))}` : '–'}</strong><small>各轮训练综合</small></div>
          </section>
          <div className="report-grid">
            <section className="work-section">
              <div className="section-title-row"><div><h2>分科训练表现</h2><p>第一轮用于诊断，第二轮用于迁移强化。</p></div><BarChart3 size={20} /></div>
              <SubjectBars rows={data.results} />
            </section>
            <section className="work-section">
              <div className="section-title-row"><div><h2>本期改善</h2><p>最近进入“正在改善”或“已掌握”的知识点。</p></div><TrendingUp size={20} /></div>
              {data.improvements.length ? <div className="report-point-list">{data.improvements.map((point) => <div key={point.id}><SubjectMark subject={point.subject} compact /><span><strong>{point.title}</strong><small>掌握度 {Math.round(Number(point.mastery_score || 0))}%</small></span><Status value={point.status} /></div>)}</div> : <EmptyState title="本期还没有明确改善项" detail="需要先完成训练并形成掌握度变化。" />}
            </section>
            <section className="work-section">
              <div className="section-title-row"><div><h2>持续薄弱点</h2><p>优先处理多次出现或掌握度仍较低的问题。</p></div><FileText size={20} /></div>
              {data.persistent.length ? <div className="report-point-list">{data.persistent.map((point) => <div key={point.id}><b>{point.priority}</b><span><strong>{point.title}</strong><small>{subjectName(point.subject)} · 出现 {point.occurrence_count} 次</small></span><strong>{Math.round(Number(point.mastery_score || 0))}%</strong></div>)}</div> : <EmptyState title="当前没有持续薄弱点" />}
            </section>
            <section className="work-section ai-report">
              <div className="section-title-row"><div><h2>家长阅读摘要</h2><p>由当前报告数据生成，保留模型与提示词来源。</p></div><Button icon={Sparkles} onClick={generateNarrative} disabled={generating}>{generating ? '正在生成...' : '生成智能摘要'}</Button></div>
              {narrative ? (
                <div className="narrative">
                  <h3>{narrative.title || `${data.days} 天学习摘要`}</h3>
                  <p>{narrative.summary}</p>
                  {narrative.highlights?.length ? <div><strong>值得肯定</strong><ul>{narrative.highlights.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
                  {narrative.persistentConcerns?.length ? <div><strong>持续关注</strong><ul>{narrative.persistentConcerns.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
                  {narrative.trainingEffect ? <div><strong>训练效果</strong><p>{narrative.trainingEffect}</p></div> : null}
                  {narrative.nextSteps?.length ? <div><strong>下一步</strong><ul>{narrative.nextSteps.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
                  {narrative.evidenceLimits?.length ? <div><strong>证据限制</strong><ul>{narrative.evidenceLimits.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
                  <small>技能 {provenance?.skillSlug} v{provenance?.skillVersion} · 提示词 {provenance?.promptSlug} v{provenance?.promptVersion} · 模型 {provenance?.modelKey}</small>
                </div>
              ) : <Notice>报告先展示客观统计；智能摘要需要家长主动生成，不会覆盖原始数据。</Notice>}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}

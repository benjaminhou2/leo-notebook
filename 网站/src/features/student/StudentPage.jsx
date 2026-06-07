import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  GraduationCap,
  History,
  RefreshCw,
  Trophy
} from 'lucide-react';
import { api, formatDate } from '../../api.js';
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
import { QuizRunner } from '../training/TrainingPage.jsx';

function Today({ onStart }) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  async function load() {
    try {
      setState({ loading: false, data: await api('/api/student/today'), error: '' });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }
  useEffect(() => { load(); }, []);
  if (state.loading) return <Loading label="正在准备今天的学习..." />;
  if (state.error) return <ErrorNotice message={state.error} onRetry={load} />;
  const { tasks, progress, improvements } = state.data;
  return (
    <div className="page student-page">
      <PageHeading title="Leo，今天学这几项" detail="一次做好一件事，完成后就可以休息。" />
      <section className="student-summary">
        <div><Clock3 size={22} /><span>预计用时</span><strong>{progress.planned_minutes || 0} 分钟</strong></div>
        <div><BookOpenCheck size={22} /><span>今天完成</span><strong>{progress.completed_today || 0} 项</strong></div>
        <div><Trophy size={22} /><span>剩余任务</span><strong>{progress.remaining || 0} 项</strong></div>
      </section>
      {tasks.length ? (
        <div className="student-task-list">
          {tasks.map((task, index) => (
            <article key={task.id}>
              <span className="student-task-number">{index + 1}</span>
              <div><span><SubjectMark subject={task.subject} compact /><Status value={task.status} /></span><h2>{task.title}</h2><p>{task.reason}</p><small>目标：{task.mastery_goal || '认真完成并理解错因'} · {task.estimated_minutes} 分钟</small></div>
              <Button icon={ArrowRight} onClick={() => onStart(task)}>{task.task_type === 'review' ? '开始复习' : '开始训练'}</Button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title={Number(progress.completed_today || 0) > 0 ? '今天的任务完成了' : '今天还没有已发布任务'}
          detail={Number(progress.completed_today || 0) > 0 ? '做得很好。系统会在该复习的时候提醒你。' : '家长完成题目质量检查并发布后，学习任务会出现在这里。'}
        />
      )}
      {improvements.length ? <section className="student-progress-band"><div><CheckCircle2 size={22} /><h2>最近的进步</h2></div>{improvements.map((point) => <div key={point.id}><SubjectMark subject={point.subject} compact /><strong>{point.title}</strong><Progress value={point.mastery_score} tone="mint" /></div>)}</section> : null}
    </div>
  );
}

function Explanations() {
  const [state, setState] = useState({ loading: true, rows: [], error: '' });
  const [generated, setGenerated] = useState({});
  const [busyId, setBusyId] = useState(null);
  useEffect(() => {
    api('/api/quiz/history')
      .then((rows) => setState({ loading: false, rows, error: '' }))
      .catch((error) => setState({ loading: false, rows: [], error: error.message }));
  }, []);

  async function generate(row) {
    setBusyId(row.id);
    try {
      const result = await api(`/api/quiz/results/${row.id}/explain`, { method: 'POST', body: '{}' });
      setGenerated((current) => ({ ...current, [row.id]: result }));
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setBusyId(null);
    }
  }

  if (state.loading) return <Loading />;
  return (
    <div className="page student-page">
      <PageHeading title="错题讲解" detail="先看错在哪里，再看下一次怎样判断。" />
      <ErrorNotice message={state.error} />
      {state.rows.length ? (
        <div className="history-list">
          {state.rows.map((row) => (
            <article key={row.id}>
              <span className="history-score">{row.score}</span>
              <div>
                <span><SubjectMark subject={row.subject} compact />第 {row.round} 轮</span>
                <h2>{row.pointTitle}</h2>
                <p>{row.wrongTags.length ? `需要再理解：${row.wrongTags.join('、')}` : '这次全部掌握，继续保持。'}</p>
                <small>{formatDate(row.completedAt, true)}</small>
                {row.wrongDetails?.length ? (
                  <div className="wrong-detail-list">
                    {row.wrongDetails.map((detail) => (
                      <div key={detail.questionId}>
                        <strong>{detail.prompt}</strong>
                        <span>Leo 的答案：{detail.studentAnswer || '未作答'}</span>
                        <span>正确答案：{detail.correctAnswer}</span>
                        <p>{detail.explanation || '这道题暂时没有现成讲解，可以生成孩子版讲解。'}</p>
                      </div>
                    ))}
                    <Button icon={GraduationCap} variant="secondary" onClick={() => generate(row)} disabled={busyId === row.id}>
                      {busyId === row.id ? '正在生成讲解...' : '生成孩子版讲解'}
                    </Button>
                  </div>
                ) : null}
                {generated[row.id] ? (
                  <div className="leo-explanation">
                    <strong>{generated[row.id].explanation.title}</strong>
                    <p>{generated[row.id].explanation.summary}</p>
                    <ol>{generated[row.id].explanation.steps?.map((step) => <li key={step}>{step}</li>)}</ol>
                    <b>自查提示：{generated[row.id].explanation.selfCheck}</b>
                    <small>技能 {generated[row.id].provenance.skillSlug} v{generated[row.id].provenance.skillVersion} · 提示词 v{generated[row.id].provenance.promptVersion}</small>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : <EmptyState title="还没有错题记录" detail="完成训练后，这里会整理需要再理解的知识标签。" />}
    </div>
  );
}

function Reviews({ onStart }) {
  const [state, setState] = useState({ loading: true, rows: [], error: '' });
  useEffect(() => {
    api('/api/tasks')
      .then((rows) => setState({ loading: false, rows: rows.filter((item) => item.task_type === 'review' && item.status !== 'completed'), error: '' }))
      .catch((error) => setState({ loading: false, rows: [], error: error.message }));
  }, []);
  if (state.loading) return <Loading />;
  return (
    <div className="page student-page">
      <PageHeading title="到期复习" detail="在快要忘记前再练一次，会记得更牢。" />
      <ErrorNotice message={state.error} />
      {state.rows.length ? <div className="student-task-list">{state.rows.map((task) => <article key={task.id}><span className="student-task-number"><RefreshCw size={18} /></span><div><span><SubjectMark subject={task.subject} compact /><Status value={task.status} /></span><h2>{task.title}</h2><p>{task.reason}</p><small>计划日期：{formatDate(task.due_at)}</small></div><Button onClick={() => onStart(task)}>开始复习</Button></article>)}</div> : <EmptyState title="当前没有到期复习" detail="系统会根据训练成绩自动安排复习间隔。" />}
    </div>
  );
}

function ProgressPage() {
  const [state, setState] = useState({ loading: true, points: [], history: [], error: '' });
  useEffect(() => {
    Promise.all([api('/api/knowledge-points'), api('/api/quiz/history')])
      .then(([points, history]) => setState({ loading: false, points, history, error: '' }))
      .catch((error) => setState({ loading: false, points: [], history: [], error: error.message }));
  }, []);
  const average = useMemo(() => state.points.length ? state.points.reduce((sum, point) => sum + point.masteryScore, 0) / state.points.length : 0, [state.points]);
  if (state.loading) return <Loading />;
  return (
    <div className="page student-page">
      <PageHeading title="我的进步" detail="每一次订正和练习，都会让掌握度往前走。" />
      <ErrorNotice message={state.error} />
      <section className="student-summary"><div><Trophy size={22} /><span>平均掌握度</span><strong>{Math.round(average)}%</strong></div><div><GraduationCap size={22} /><span>已掌握</span><strong>{state.points.filter((point) => point.status === 'mastered').length} 个</strong></div><div><History size={22} /><span>完成训练</span><strong>{state.history.length} 次</strong></div></section>
      <div className="progress-cards">{state.points.map((point) => <article key={point.id}><span><SubjectMark subject={point.subject} compact /><Status value={point.status} /></span><strong>{point.title}</strong><Progress value={point.masteryScore} label="掌握度" tone={point.status === 'mastered' ? 'mint' : 'sky'} /></article>)}</div>
    </div>
  );
}

export default function StudentPage({ page, onPageChange }) {
  const [runner, setRunner] = useState(null);

  async function startTask(task) {
    const round = task.task_type === 'round2' ? 2 : 1;
    const questions = await api(`/api/quiz/questions?pointId=${encodeURIComponent(task.point_id)}&round=${round}`);
    if (questions.length) {
      setRunner({ pointId: task.point_id, round, title: task.title });
    } else {
      onPageChange('today');
      window.alert('这项训练还没有由家长发布，请先请家长检查题目。');
    }
  }

  if (runner) return <QuizRunner {...runner} onBack={() => setRunner(null)} />;
  if (page === 'explanations') return <Explanations />;
  if (page === 'reviews') return <Reviews onStart={startTask} />;
  if (page === 'progress') return <ProgressPage />;
  return <Today onStart={startTask} />;
}

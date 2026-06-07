import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ClipboardCheck,
  Edit3,
  Lock,
  Play,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
  TriangleAlert
} from 'lucide-react';
import { api, formatDate } from '../../api.js';
import {
  Button,
  EmptyState,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  Notice,
  PageHeading,
  Progress,
  Status,
  SubjectMark
} from '../../components/Common.jsx';

function QuestionEditor({ question, onClose, onSaved, onDeleted }) {
  const [draft, setDraft] = useState(question);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setBusy(true);
    try {
      await api(`/api/quiz/questions/${question.id}`, { method: 'PATCH', body: JSON.stringify(draft) });
      await onSaved();
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="编辑训练题" size="lg" onClose={onClose} footer={<><Button variant="danger" icon={Trash2} onClick={onDeleted}>删除</Button><Button icon={Save} onClick={save} disabled={busy}>保存修改</Button></>}>
      <ErrorNotice message={error} />
      <div className="form-stack">
        <div className="form-grid form-grid-3">
          <Field label="题型"><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}><option value="choice">选择题</option><option value="fill">填空题</option><option value="judge">判断题</option><option value="short">简答题</option></select></Field>
          <Field label="难度"><input type="number" min="1" max="5" value={draft.difficulty} onChange={(event) => setDraft({ ...draft, difficulty: event.target.value })} /></Field>
          <Field label="知识标签"><input value={draft.tag} onChange={(event) => setDraft({ ...draft, tag: event.target.value })} /></Field>
        </div>
        <Field label="题干"><textarea rows="4" value={draft.prompt} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} /></Field>
        {draft.type === 'choice' ? <Field label="选项" hint="每行一个，必须有 4 个有效选项"><textarea rows="5" value={(draft.options || []).join('\n')} onChange={(event) => setDraft({ ...draft, options: event.target.value.split('\n').filter(Boolean) })} /></Field> : null}
        <Field label="正确答案" hint="每行一个可接受答案"><textarea rows="3" value={(draft.answers || []).join('\n')} onChange={(event) => setDraft({ ...draft, answers: event.target.value.split('\n').filter(Boolean) })} /></Field>
        <Field label="讲解"><textarea rows="3" value={draft.explanation} onChange={(event) => setDraft({ ...draft, explanation: event.target.value })} /></Field>
        <div className="form-grid form-grid-2">
          <Field label="出题依据"><textarea rows="2" value={draft.sourceBasis} onChange={(event) => setDraft({ ...draft, sourceBasis: event.target.value })} /></Field>
          <Field label="预期识别的错误"><textarea rows="2" value={draft.expectedError} onChange={(event) => setDraft({ ...draft, expectedError: event.target.value })} /></Field>
        </div>
        <label className="check-line"><input type="checkbox" checked={draft.locked} onChange={(event) => setDraft({ ...draft, locked: event.target.checked })} /> 锁定此题，重新生成时保留</label>
      </div>
    </Modal>
  );
}

function PlanDetail({ plan, onChanged, onStart }) {
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function action(kind) {
    setBusy(kind);
    setError('');
    setNotice('');
    try {
      if (kind === 'check') {
        const result = await api(`/api/training-plans/${plan.id}/check`, { method: 'POST', body: '{}' });
        setNotice(result.quality.passed ? '质量检查通过，可以发布。' : `仍有 ${result.quality.issues.length} 项需要处理。`);
      } else if (kind === 'publish') {
        await api(`/api/training-plans/${plan.id}/publish`, { method: 'POST', body: '{}' });
        setNotice('训练已发布到 Leo 端。');
      } else {
        await api('/api/training-plans/generate', {
          method: 'POST',
          body: JSON.stringify({ pointId: plan.point_id, round: plan.round, questionCount: Math.max(8, plan.question_count), keepLocked: true })
        });
        setNotice('已重新生成，锁定题目保持不变。');
      }
      await onChanged();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  }

  async function removeQuestion(question) {
    if (!window.confirm('确认删除这道题吗？')) return;
    await api(`/api/quiz/questions/${question.id}`, { method: 'DELETE' });
    setEditing(null);
    onChanged();
  }

  return (
    <section className="plan-detail">
      <div className="detail-heading">
        <div><span><SubjectMark subject={plan.subject} compact /><b>{plan.priority}</b><Status value={plan.status} /></span><h2>{plan.title}</h2><p>{plan.goal}</p></div>
        <div className="page-actions">
          <Button variant="secondary" icon={RefreshCw} onClick={() => action('regenerate')} disabled={Boolean(busy)}>重新生成</Button>
          <Button variant="secondary" icon={ClipboardCheck} onClick={() => action('check')} disabled={Boolean(busy)}>质量检查</Button>
          {plan.status === 'published'
            ? <Button icon={Play} onClick={() => onStart(plan)}>开始试做</Button>
            : <Button icon={Send} onClick={() => action('publish')} disabled={Boolean(busy)}>发布给 Leo</Button>}
        </div>
      </div>
      <ErrorNotice message={error} />
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      <div className="quality-band">
        <div><span>质量评分</span><strong>{Math.round(Number(plan.quality_score || 0))}</strong></div>
        <Progress value={plan.quality_score} tone={Number(plan.quality_score) >= 80 ? 'mint' : 'peach'} />
        <div><span>题目数量</span><strong>{plan.questions.length}</strong></div>
        <div><span>预计用时</span><strong>{plan.estimated_minutes} 分钟</strong></div>
      </div>
      {plan.quality_issues?.length ? (
        <div className="quality-issues"><TriangleAlert size={18} /><div><strong>质量检查待处理</strong>{plan.quality_issues.map((issue, index) => <p key={`${issue.code || 'issue'}-${index}`}>{issue.message || String(issue)}</p>)}</div></div>
      ) : <Notice tone="success">没有发现重复题、敷衍选项或缺失答案等质量问题。</Notice>}
      <div className="question-review-list">
        {plan.questions.map((question, index) => (
          <article key={question.id}>
            <div className="question-index">{index + 1}</div>
            <div className="question-copy">
              <div><Status value={question.qualityStatus === 'passed' ? 'healthy' : 'needs_review'} /><span>难度 {question.difficulty}</span>{question.locked ? <span><Lock size={13} />已锁定</span> : null}</div>
              <strong>{question.prompt}</strong>
              {question.options?.length ? <ol type="A">{question.options.map((option) => <li key={option}>{option}</li>)}</ol> : null}
              <small>答案：{question.answers.join(' / ')} · 依据：{question.sourceBasis || '未填写'}</small>
            </div>
            <Button variant="text" icon={Edit3} onClick={() => setEditing(question)}>编辑</Button>
          </article>
        ))}
      </div>
      {editing ? <QuestionEditor question={editing} onClose={() => setEditing(null)} onSaved={onChanged} onDeleted={() => removeQuestion(editing)} /> : null}
    </section>
  );
}

export function QuizRunner({ pointId, round, title, onBack, onCompleted }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [state, setState] = useState({ loading: true, error: '' });
  const [startedAt] = useState(Date.now());

  useEffect(() => {
    api(`/api/quiz/questions?pointId=${encodeURIComponent(pointId)}&round=${round}`)
      .then((data) => {
        setQuestions(data);
        setState({ loading: false, error: '' });
      })
      .catch((error) => setState({ loading: false, error: error.message }));
  }, [pointId, round]);

  async function submit() {
    try {
      const data = await api('/api/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({ pointId, round, answers, durationSeconds: Math.round((Date.now() - startedAt) / 1000) })
      });
      setResult(data);
      onCompleted?.();
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    }
  }

  if (state.loading) return <Loading label="正在准备训练题..." />;
  return (
    <div className="quiz-page page">
      <PageHeading title={title} detail={`第 ${round} 轮 · 共 ${questions.length} 题`} actions={<Button variant="secondary" onClick={onBack}>返回训练管理</Button>} />
      <ErrorNotice message={state.error} />
      {result ? (
        <section className="quiz-result">
          <CheckCircle2 size={32} /><span>本轮得分</span><strong>{result.score}</strong><p>答对 {result.correctCount} / {result.totalCount} 题，当前掌握度 {result.masteryScore}%。</p>
          {result.wrongTags.length ? <div>下一轮重点：{result.wrongTags.join('、')}</div> : <div>本轮表现稳定，已安排后续到期复习。</div>}
          <Button onClick={onBack}>完成</Button>
        </section>
      ) : questions.length ? (
        <>
          <div className="quiz-question-list">
            {questions.map((question, index) => (
              <article key={question.id}>
                <span className="question-number">{index + 1}</span>
                <div><strong>{question.prompt}</strong>
                  {question.type === 'choice' ? (
                    <div className="answer-options">{question.options.map((option) => <label key={option}><input type="radio" name={question.id} checked={answers[question.id] === option} onChange={() => setAnswers({ ...answers, [question.id]: option })} />{option}</label>)}</div>
                  ) : question.type === 'judge' ? (
                    <div className="answer-options inline">{['正确', '错误'].map((option) => <label key={option}><input type="radio" name={question.id} checked={answers[question.id] === option} onChange={() => setAnswers({ ...answers, [question.id]: option })} />{option}</label>)}</div>
                  ) : <input className="answer-input" value={answers[question.id] || ''} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} placeholder="在这里作答" />}
                </div>
              </article>
            ))}
          </div>
          <Button icon={Check} onClick={submit}>提交本轮答案</Button>
        </>
      ) : <EmptyState title="这轮训练还没有发布" detail="请先在家长端生成、检查并发布题目。" />}
    </div>
  );
}

export default function TrainingPage({ initialState, clearInitialState }) {
  const [plans, setPlans] = useState([]);
  const [points, setPoints] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [runner, setRunner] = useState(null);
  const [generate, setGenerate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState({ loading: true, error: '' });

  async function load() {
    setState({ loading: true, error: '' });
    try {
      const [planRows, pointRows] = await Promise.all([api('/api/training-plans'), api('/api/knowledge-points')]);
      setPlans(planRows);
      setPoints(pointRows);
      setSelectedId((current) => current || planRows[0]?.id || null);
      setState({ loading: false, error: '' });
    } catch (error) {
      setState({ loading: false, error: error.message });
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (initialState?.pointId) {
      const plan = plans.find((item) => item.point_id === initialState.pointId);
      if (plan) setSelectedId(plan.id);
      else setGenerate({ pointId: initialState.pointId, round: 1, questionCount: 8, minutes: 10 });
      clearInitialState?.();
    }
  }, [initialState, plans]);

  async function createPlan() {
    setBusy(true);
    try {
      const result = await api('/api/training-plans/generate', { method: 'POST', body: JSON.stringify(generate) });
      await load();
      setSelectedId(result.planId);
      setGenerate(null);
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setBusy(false);
    }
  }

  const selected = plans.find((plan) => plan.id === selectedId);
  const availablePoints = useMemo(() => points.filter((point) => point.status !== 'mastered' || point.nextReviewAt), [points]);
  if (runner) return <QuizRunner {...runner} onBack={() => setRunner(null)} onCompleted={load} />;

  return (
    <div className="page">
      <PageHeading title="训练与复习" detail="围绕真实薄弱点生成两轮差异化训练，发布前先通过质量检查。" actions={<Button icon={Sparkles} onClick={() => setGenerate({ pointId: availablePoints[0]?.id || '', round: 1, questionCount: 8, minutes: 10 })}>生成训练计划</Button>} />
      <ErrorNotice message={state.error} onRetry={load} />
      {state.loading ? <Loading label="正在读取训练计划..." /> : plans.length ? (
        <div className="training-layout">
          <aside className="plan-list">
            {plans.map((plan) => (
              <button type="button" key={plan.id} className={selectedId === plan.id ? 'active' : ''} onClick={() => setSelectedId(plan.id)}>
                <span><SubjectMark subject={plan.subject} compact /><Status value={plan.status} /></span>
                <strong>{plan.title}</strong>
                <small>质量 {Math.round(Number(plan.quality_score || 0))} · {plan.question_count} 题 · 更新于 {formatDate(plan.updated_at)}</small>
                <Progress value={plan.quality_score} tone={Number(plan.quality_score) >= 80 ? 'mint' : 'peach'} />
              </button>
            ))}
          </aside>
          {selected ? <PlanDetail plan={selected} onChanged={load} onStart={(plan) => setRunner({ pointId: plan.point_id, round: plan.round, title: plan.title })} /> : null}
        </div>
      ) : <EmptyState title="还没有训练计划" detail="知识画像形成后，可为薄弱点生成第一轮诊断题。" action={<Button icon={Sparkles} onClick={() => setGenerate({ pointId: availablePoints[0]?.id || '', round: 1, questionCount: 8, minutes: 10 })}>生成第一份训练</Button>} />}

      {generate ? (
        <Modal title="生成个性化训练" onClose={() => setGenerate(null)} footer={<Button icon={Sparkles} onClick={createPlan} disabled={busy || !generate.pointId}>{busy ? '模型正在生成并检查...' : '生成并自动质检'}</Button>}>
          <div className="form-stack">
            <Field label="训练知识点"><select value={generate.pointId} onChange={(event) => setGenerate({ ...generate, pointId: event.target.value })}><option value="">请选择</option>{availablePoints.map((point) => <option key={point.id} value={point.id}>{point.priority} · {point.title}</option>)}</select></Field>
            <div className="form-grid form-grid-3">
              <Field label="训练轮次"><select value={generate.round} onChange={(event) => setGenerate({ ...generate, round: Number(event.target.value) })}><option value="1">第一轮</option><option value="2">第二轮</option></select></Field>
              <Field label="题目数量"><input type="number" min="6" max="12" value={generate.questionCount} onChange={(event) => setGenerate({ ...generate, questionCount: Number(event.target.value) })} /></Field>
              <Field label="预计分钟"><input type="number" min="5" max="30" value={generate.minutes} onChange={(event) => setGenerate({ ...generate, minutes: Number(event.target.value) })} /></Field>
            </div>
            <Notice>第二轮会读取第一轮错题，并检查题干相似度与选项质量；生成失败时会保留错误记录，不会伪造题目。</Notice>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

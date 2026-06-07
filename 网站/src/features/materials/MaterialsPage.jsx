import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  FileImage,
  FilePlus2,
  Filter,
  ImagePlus,
  LoaderCircle,
  Pencil,
  RefreshCw,
  RotateCw,
  Save,
  Search,
  Sparkles,
  TriangleAlert,
  Upload,
  X
} from 'lucide-react';
import { api, formatDate, materialUrl, statusName, subjectName } from '../../api.js';
import {
  Button,
  EmptyState,
  ErrorNotice,
  Field,
  IconButton,
  Loading,
  Modal,
  Notice,
  PageHeading,
  Progress,
  Status,
  SubjectMark
} from '../../components/Common.jsx';

const materialTypes = ['本周测试', '日常作业', '阅读理解', '作文', '单词听写', '自主练习', '其他'];

function fileToData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      size: file.size,
      base64: reader.result
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function UploadModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    subject: 'math',
    date: new Date().toISOString().slice(0, 10),
    type: '本周测试',
    title: '',
    priority: 'P1',
    score: '',
    summary: '',
    grade: '小学五年级',
    semester: '下学期',
    textbookVersion: '待确认',
    unitName: '',
    hasAnswers: false,
    hasTeacherMarks: true
  });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function addFiles(selected) {
    setError('');
    const incoming = Array.from(selected || []);
    if (files.length + incoming.length > 6) {
      setError('一次最多上传 6 个文件。');
      return;
    }
    const invalid = incoming.find((file) =>
      !file.type.startsWith('image/') && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')
    );
    if (invalid) {
      setError(`不支持文件：${invalid.name}`);
      return;
    }
    const converted = await Promise.all(incoming.map(fileToData));
    setFiles((current) => [...current, ...converted]);
  }

  function moveFile(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= files.length) return;
    setFiles((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.title.trim()) return setError('请填写素材标题。');
    if (!files.length) return setError('请至少上传一个图片或 PDF。');
    setBusy(true);
    setError('');
    try {
      const result = await api('/api/materials', {
        method: 'POST',
        body: JSON.stringify({ ...form, uploadedFiles: files })
      });
      onCreated(result.id);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="录入新的学习素材"
      size="lg"
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>取消</Button>
          <Button icon={Upload} onClick={submit} disabled={busy}>
            {busy ? '正在保存...' : '保存素材'}
          </Button>
        </>
      )}
    >
      <ErrorNotice message={error} />
      <form className="form-stack" onSubmit={submit}>
        <div className="form-grid form-grid-3">
          <Field label="科目" required>
            <select value={form.subject} onChange={(event) => update('subject', event.target.value)}>
              <option value="chinese">语文</option>
              <option value="math">数学</option>
              <option value="english">英文</option>
            </select>
          </Field>
          <Field label="素材类型" required>
            <select value={form.type} onChange={(event) => update('type', event.target.value)}>
              {materialTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </Field>
          <Field label="日期" required>
            <input type="date" value={form.date} onChange={(event) => update('date', event.target.value)} />
          </Field>
        </div>
        <Field label="素材标题" required>
          <input value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="例如：数学第五单元周测试" />
        </Field>
        <div className="form-grid form-grid-3">
          <Field label="年级">
            <input value={form.grade} onChange={(event) => update('grade', event.target.value)} />
          </Field>
          <Field label="学期">
            <select value={form.semester} onChange={(event) => update('semester', event.target.value)}>
              <option>上学期</option>
              <option>下学期</option>
            </select>
          </Field>
          <Field label="教材版本" hint="尚未确认时可保留“待确认”">
            <input value={form.textbookVersion} onChange={(event) => update('textbookVersion', event.target.value)} />
          </Field>
        </div>
        <div className="form-grid form-grid-3">
          <Field label="单元或章节">
            <input value={form.unitName} onChange={(event) => update('unitName', event.target.value)} />
          </Field>
          <Field label="优先级">
            <select value={form.priority} onChange={(event) => update('priority', event.target.value)}>
              <option value="P0">P0 高</option>
              <option value="P1">P1 中</option>
              <option value="P2">P2 低</option>
            </select>
          </Field>
          <Field label="得分">
            <input type="number" min="0" max="100" value={form.score} onChange={(event) => update('score', event.target.value)} />
          </Field>
        </div>
        <Field label="素材说明">
          <textarea rows="2" value={form.summary} onChange={(event) => update('summary', event.target.value)} placeholder="可写本次测试范围或家长观察。" />
        </Field>
        <div className="check-row">
          <label><input type="checkbox" checked={form.hasAnswers} onChange={(event) => update('hasAnswers', event.target.checked)} /> 包含参考答案</label>
          <label><input type="checkbox" checked={form.hasTeacherMarks} onChange={(event) => update('hasTeacherMarks', event.target.checked)} /> 包含老师批改</label>
        </div>

        <div
          className="upload-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            addFiles(event.dataTransfer.files);
          }}
        >
          <ImagePlus size={28} />
          <strong>拖入图片或 PDF</strong>
          <span>系统会保留原始文件，PDF 自动分页生成分析图。</span>
          <label className="button button-secondary button-md">
            <FilePlus2 size={17} />
            <span>选择文件</span>
            <input type="file" accept="image/*,application/pdf" multiple hidden onChange={(event) => addFiles(event.target.files)} />
          </label>
        </div>

        {files.length ? (
          <div className="upload-file-list">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`}>
                <FileImage size={18} />
                <span><strong>{file.name}</strong><small>{Math.round(file.size / 1024)} KB</small></span>
                <IconButton icon={ChevronLeft} label="上移" disabled={index === 0} onClick={() => moveFile(index, -1)} />
                <IconButton icon={ChevronRight} label="下移" disabled={index === files.length - 1} onClick={() => moveFile(index, 1)} />
                <IconButton icon={X} label="移除" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} />
              </div>
            ))}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

function QuestionEditor({ materialId, question, onSaved }) {
  const [draft, setDraft] = useState(question);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setDraft(question), [question]);

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api(`/api/materials/${materialId}/questions/${question.id}`, {
        method: 'PATCH',
        body: JSON.stringify(draft)
      });
      onSaved();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inspector-form">
      <ErrorNotice message={error} />
      <div className="form-grid form-grid-3">
        <Field label="题号"><input value={draft.number || ''} onChange={(event) => setDraft({ ...draft, number: event.target.value })} /></Field>
        <Field label="题型"><input value={draft.type || ''} onChange={(event) => setDraft({ ...draft, type: event.target.value })} /></Field>
        <Field label="分值"><input type="number" value={draft.score ?? ''} onChange={(event) => setDraft({ ...draft, score: event.target.value })} /></Field>
      </div>
      <Field label="题干"><textarea rows="4" value={draft.prompt || ''} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} /></Field>
      <Field label="Leo 答案"><textarea rows="2" value={draft.studentAnswer || ''} onChange={(event) => setDraft({ ...draft, studentAnswer: event.target.value })} /></Field>
      <Field label="正确答案"><textarea rows="2" value={draft.correctAnswer || ''} onChange={(event) => setDraft({ ...draft, correctAnswer: event.target.value })} /></Field>
      <Field label="老师批改"><textarea rows="2" value={draft.teacherMark || ''} onChange={(event) => setDraft({ ...draft, teacherMark: event.target.value })} /></Field>
      <Field label="证据文字"><textarea rows="2" value={draft.evidenceText || ''} onChange={(event) => setDraft({ ...draft, evidenceText: event.target.value })} /></Field>
      <div className="confidence-row">
        <Progress value={draft.confidence} label="识别置信度" tone={draft.confidence < 60 ? 'peach' : 'sky'} />
        <label><input type="checkbox" checked={draft.reviewRequired} onChange={(event) => setDraft({ ...draft, reviewRequired: event.target.checked })} /> 需复核原卷</label>
      </div>
      <Button icon={Save} onClick={save} disabled={busy}>{busy ? '保存中...' : '保存题目修改'}</Button>
    </div>
  );
}

function FindingEditor({ materialId, finding, catalog, onSaved }) {
  const [draft, setDraft] = useState(finding);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setDraft(finding), [finding]);

  async function save(nextStatus = draft.reviewStatus) {
    setBusy(true);
    setError('');
    try {
      await api(`/api/materials/${materialId}/findings/${finding.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...draft, reviewStatus: nextStatus })
      });
      onSaved();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inspector-form">
      <ErrorNotice message={error} />
      <Field label="薄弱点标题"><input value={draft.title || ''} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
      <div className="form-grid form-grid-2">
        <Field label="问题类型">
          <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
            <option value="knowledge">知识点缺口</option>
            <option value="skill">技能缺口</option>
            <option value="habit">习惯问题</option>
            <option value="difficulty">材料难度</option>
          </select>
        </Field>
        <Field label="优先级">
          <select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}>
            <option value="P0">P0 高</option>
            <option value="P1">P1 中</option>
            <option value="P2">P2 低</option>
          </select>
        </Field>
      </div>
      <Field label="对应知识点">
        <select value={draft.knowledgeCode || ''} onChange={(event) => setDraft({ ...draft, knowledgeCode: event.target.value })}>
          <option value="">暂不匹配知识点树</option>
          {catalog.map((item) => <option key={item.code} value={item.code}>{subjectName(item.subject)} · {item.title}</option>)}
        </select>
      </Field>
      <Field label="判断原因"><textarea rows="3" value={draft.reason || ''} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} /></Field>
      <Field label="原始证据"><textarea rows="3" value={draft.evidenceText || ''} onChange={(event) => setDraft({ ...draft, evidenceText: event.target.value })} /></Field>
      <div className="form-grid form-grid-2">
        <Field label="Leo 原答案"><textarea rows="2" value={draft.studentAnswer || ''} onChange={(event) => setDraft({ ...draft, studentAnswer: event.target.value })} /></Field>
        <Field label="预期答案"><textarea rows="2" value={draft.expectedAnswer || ''} onChange={(event) => setDraft({ ...draft, expectedAnswer: event.target.value })} /></Field>
      </div>
      <Progress value={draft.confidence} label="分析置信度" tone={draft.confidence < 60 ? 'peach' : 'mint'} />
      <div className="decision-row">
        <Button variant="success" icon={Check} disabled={busy} onClick={() => save('accepted')}>确认</Button>
        <Button variant="secondary" icon={Pencil} disabled={busy} onClick={() => save(draft.reviewStatus)}>保存修改</Button>
        <Button variant="warning" icon={TriangleAlert} disabled={busy} onClick={() => save('needs_review')}>需复核</Button>
        <Button variant="danger" icon={X} disabled={busy} onClick={() => save('rejected')}>驳回</Button>
      </div>
    </div>
  );
}

function MaterialReview({ materialId, onBack, onChanged }) {
  const [state, setState] = useState({ loading: true, data: null, catalog: [], error: '' });
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [selectedFindingId, setSelectedFindingId] = useState(null);
  const [inspectorTab, setInspectorTab] = useState('finding');
  const [busyAction, setBusyAction] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const [data, catalog] = await Promise.all([
        api(`/api/materials/${materialId}`),
        api('/api/knowledge/catalog')
      ]);
      setState({ loading: false, data, catalog, error: '' });
      setSelectedQuestionId((current) => current || data.questions[0]?.id || null);
      setSelectedFindingId((current) => current || data.findings[0]?.id || null);
    } catch (error) {
      setState({ loading: false, data: null, catalog: [], error: error.message });
    }
  }

  useEffect(() => {
    load();
  }, [materialId]);

  async function analyze() {
    setBusyAction('analyze');
    setNotice('');
    try {
      await api(`/api/materials/${materialId}/analyze`, { method: 'POST', body: '{}' });
      setNotice('智能分析已经完成，请逐题复核后再写入知识画像。');
      await load();
      onChanged();
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
      await load();
    } finally {
      setBusyAction('');
    }
  }

  async function rotatePage(page) {
    setBusyAction('rotate');
    try {
      await api(`/api/materials/${materialId}/pages/${page.id}/rotate`, {
        method: 'POST',
        body: JSON.stringify({ degrees: 90 })
      });
      await load();
    } finally {
      setBusyAction('');
    }
  }

  async function confirmAll() {
    const acceptedFindingIds = state.data.findings.filter((finding) => finding.reviewStatus === 'accepted').map((finding) => finding.id);
    const rejectedFindingIds = state.data.findings.filter((finding) => finding.reviewStatus === 'rejected').map((finding) => finding.id);
    const reviewRequiredFindingIds = state.data.findings.filter((finding) => finding.reviewStatus === 'needs_review').map((finding) => finding.id);
    if (!acceptedFindingIds.length) {
      setState((current) => ({ ...current, error: '请至少确认一个有证据支持的薄弱点。' }));
      return;
    }
    setBusyAction('confirm');
    try {
      await api(`/api/materials/${materialId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ acceptedFindingIds, rejectedFindingIds, reviewRequiredFindingIds })
      });
      setNotice('已写入 Leo 的知识画像，并生成第一轮诊断任务。');
      await load();
      onChanged();
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally {
      setBusyAction('');
    }
  }

  if (state.loading && !state.data) return <Loading label="正在打开素材审核..." />;
  if (state.error && !state.data) return <ErrorNotice message={state.error} onRetry={load} />;

  const material = state.data;
  const page = material.pages[pageIndex];
  const selectedQuestion = material.questions.find((question) => question.id === selectedQuestionId);
  const selectedFinding = material.findings.find((finding) => finding.id === selectedFindingId);

  return (
    <div className="review-page">
      <header className="review-header">
        <div>
          <Button variant="text" icon={ArrowLeft} onClick={onBack}>返回素材中心</Button>
          <h1>{material.title}</h1>
          <span><SubjectMark subject={material.subject} compact /> {material.type} · {formatDate(material.date)} · <Status value={material.status} /></span>
        </div>
        <div className="page-actions">
          <Button variant="secondary" icon={Sparkles} onClick={analyze} disabled={Boolean(busyAction)}>
            {busyAction === 'analyze' ? '正在分析...' : material.analysisStatus === 'completed' || material.analysisStatus === 'confirmed' ? '重新分析' : '启动智能分析'}
          </Button>
          <Button icon={Check} onClick={confirmAll} disabled={Boolean(busyAction) || !material.findings.length}>
            {busyAction === 'confirm' ? '正在写入...' : '确认并写入知识画像'}
          </Button>
        </div>
      </header>
      <ErrorNotice message={state.error} />
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {material.processingError ? <Notice tone="danger">最近一次处理失败：{material.processingError}</Notice> : null}

      <div className="review-provenance">
        <span>技能：{material.provenance.skillSlug || '尚未运行'}</span>
        <span>提示词：{material.provenance.promptSlug || '尚未运行'}</span>
        <span>模型：{material.provenance.modelKey || '尚未运行'}</span>
        <span>分析置信度：{Math.round(material.analysisConfidence || 0)}%</span>
      </div>

      <div className="review-layout">
        <aside className="page-rail">
          {material.pages.map((item, index) => (
            <button type="button" className={pageIndex === index ? 'active' : ''} key={item.id} onClick={() => setPageIndex(index)}>
              <span>第 {item.pageNumber} 页</span>
              <small>{Math.round(item.clarityScore)} 分清晰度</small>
              {item.reviewRequired ? <TriangleAlert size={14} /> : null}
            </button>
          ))}
        </aside>

        <section className="source-viewer">
          <div className="viewer-toolbar">
            <span>{page ? `第 ${page.pageNumber} 页` : '暂无页面'}</span>
            <div>
              <IconButton icon={ChevronLeft} label="上一页" disabled={pageIndex === 0} onClick={() => setPageIndex((value) => value - 1)} />
              <IconButton icon={ChevronRight} label="下一页" disabled={pageIndex >= material.pages.length - 1} onClick={() => setPageIndex((value) => value + 1)} />
              {page ? <IconButton icon={RotateCw} label="顺时针旋转" disabled={busyAction === 'rotate'} onClick={() => rotatePage(page)} /> : null}
            </div>
          </div>
          <div className="source-canvas">
            {page ? <img src={materialUrl(page.source)} alt={`${material.title} 第${page.pageNumber}页`} /> : <EmptyState title="没有可预览的页面" />}
          </div>
        </section>

        <section className="question-panel">
          <div className="panel-heading">
            <div><h2>结构化题目</h2><span>{material.questions.length} 道</span></div>
          </div>
          {material.questions.length ? (
            <div className="question-table">
              <div className="question-table-head"><span>题号</span><span>题型</span><span>Leo 答案</span><span>结果</span><span>置信度</span></div>
              {material.questions.map((question) => (
                <button
                  type="button"
                  key={question.id}
                  className={selectedQuestionId === question.id ? 'active' : ''}
                  onClick={() => {
                    setSelectedQuestionId(question.id);
                    setInspectorTab('question');
                  }}
                >
                  <span>{question.number}</span>
                  <span>{question.type || '未识别'}</span>
                  <span>{question.studentAnswer || '未识别'}</span>
                  <span>{question.teacherMark || '待判断'}</span>
                  <span className={question.confidence < 60 ? 'low-confidence' : ''}>{Math.round(question.confidence)}%</span>
                </button>
              ))}
            </div>
          ) : <EmptyState title="尚未识别题目" detail="启动智能分析后，系统会把题目、答案和批改拆分到这里。" />}
        </section>

        <aside className="review-inspector">
          <div className="inspector-tabs">
            <button type="button" className={inspectorTab === 'finding' ? 'active' : ''} onClick={() => setInspectorTab('finding')}>诊断与证据</button>
            <button type="button" className={inspectorTab === 'question' ? 'active' : ''} onClick={() => setInspectorTab('question')}>题目校对</button>
          </div>
          {inspectorTab === 'finding' ? (
            <>
              <div className="finding-list">
                {material.findings.map((finding) => (
                  <button
                    type="button"
                    key={finding.id}
                    className={selectedFindingId === finding.id ? 'active' : ''}
                    onClick={() => setSelectedFindingId(finding.id)}
                  >
                    <span><b>{finding.priority}</b><Status value={finding.reviewStatus} /></span>
                    <strong>{finding.title}</strong>
                    <small>{finding.evidenceText || '缺少证据文字'}</small>
                  </button>
                ))}
              </div>
              {selectedFinding
                ? <FindingEditor materialId={materialId} finding={selectedFinding} catalog={state.catalog} onSaved={load} />
                : <EmptyState title="选择一条诊断结果" />}
            </>
          ) : selectedQuestion
            ? <QuestionEditor materialId={materialId} question={selectedQuestion} onSaved={load} />
            : <EmptyState title="选择一道题进行校对" />}
        </aside>
      </div>
    </div>
  );
}

export default function MaterialsPage({ initialState, clearInitialState, onDataChanged }) {
  const [materials, setMaterials] = useState([]);
  const [filters, setFilters] = useState({ subject: 'all', status: 'all', q: '' });
  const [selectedId, setSelectedId] = useState(initialState?.materialId || null);
  const [showUpload, setShowUpload] = useState(false);
  const [state, setState] = useState({ loading: true, error: '' });

  async function load() {
    setState({ loading: true, error: '' });
    try {
      const params = new URLSearchParams();
      if (filters.subject !== 'all') params.set('subject', filters.subject);
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.q) params.set('q', filters.q);
      const data = await api(`/api/materials?${params}`);
      setMaterials(data);
      setState({ loading: false, error: '' });
    } catch (error) {
      setState({ loading: false, error: error.message });
    }
  }

  useEffect(() => {
    const timer = setTimeout(load, filters.q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    if (initialState?.materialId) {
      setSelectedId(initialState.materialId);
      clearInitialState?.();
    }
  }, [initialState]);

  if (selectedId) {
    return (
      <MaterialReview
        materialId={selectedId}
        onBack={() => {
          setSelectedId(null);
          load();
        }}
        onChanged={() => {
          onDataChanged?.();
          load();
        }}
      />
    );
  }

  return (
    <div className="page">
      <PageHeading
        title="素材中心"
        detail="从原始图片和 PDF 开始，完成结构化识别、学科诊断与人工确认。"
        actions={<Button icon={FilePlus2} onClick={() => setShowUpload(true)}>新增素材</Button>}
      />
      <ErrorNotice message={state.error} onRetry={load} />

      <div className="filter-bar">
        <div className="search-field"><Search size={17} /><input value={filters.q} onChange={(event) => setFilters({ ...filters, q: event.target.value })} placeholder="搜索素材标题或说明" /></div>
        <div className="filter-select"><Filter size={16} /><select value={filters.subject} onChange={(event) => setFilters({ ...filters, subject: event.target.value })}><option value="all">全部科目</option><option value="chinese">语文</option><option value="math">数学</option><option value="english">英文</option></select></div>
        <div className="filter-select"><ArrowUpDown size={16} /><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="all">全部状态</option><option value="pending_analysis">待分析</option><option value="pending_review">待确认</option><option value="confirmed">已确认</option><option value="analysis_failed">分析失败</option></select></div>
        <span className="filter-count">{materials.length} 份素材</span>
      </div>

      {state.loading ? <Loading label="正在读取素材..." /> : materials.length ? (
        <div className="data-table material-data-table">
          <div className="data-table-head">
            <span>素材</span><span>科目</span><span>日期</span><span>处理状态</span><span>分析置信度</span><span>下一步</span>
          </div>
          {materials.map((material) => (
            <button type="button" className="data-table-row" key={material.id} onClick={() => setSelectedId(material.id)}>
              <span className="table-primary"><strong>{material.title}</strong><small>{material.type} · {material.unitName || '未设置单元'}</small></span>
              <span><SubjectMark subject={material.subject} compact /></span>
              <span>{formatDate(material.date)}</span>
              <span><Status value={material.analysisStatus === 'completed' ? material.status : material.analysisStatus} /></span>
              <span><Progress value={material.analysisConfidence} tone={material.analysisConfidence < 60 ? 'peach' : 'mint'} /></span>
              <span className="next-action">
                {material.analysisStatus === 'not_started' ? '启动分析' : material.analysisStatus === 'failed' ? '查看错误' : material.status === 'pending_review' ? '审核分析' : '查看证据'}
                <ChevronRight size={16} />
              </span>
            </button>
          ))}
        </div>
      ) : <EmptyState title="没有符合条件的素材" detail="可以调整筛选条件，或录入一份新的试卷、作文或日常作业。" action={<Button icon={FilePlus2} onClick={() => setShowUpload(true)}>新增素材</Button>} />}

      {showUpload ? (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onCreated={(id) => {
            setShowUpload(false);
            setSelectedId(id);
            onDataChanged?.();
          }}
        />
      ) : null}
    </div>
  );
}

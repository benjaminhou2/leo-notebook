import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const CONFIG_PATHS = {
  site: '/config/site.json',
  auth: '/config/auth.json',
  index: '/config/content-index.json'
};

function materialUrl(source) {
  return `/materials/${source.split('/').map(encodeURIComponent).join('/')}`;
}

function subjectLabel(subjects, id) {
  return subjects.find((subject) => subject.id === id)?.label ?? id;
}

function subjectTone(subjects, id) {
  return subjects.find((subject) => subject.id === id)?.tone ?? 'pale-sky';
}

function groupBySubject(records, subjects) {
  return subjects.map((subject) => ({
    subject,
    records: records.filter((record) => record.subject === subject.id)
  }));
}

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`无法读取 ${path}`);
  }
  return response.json();
}

function LoginView({ site, auth, onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function submit(event) {
    event.preventDefault();
    if (password === auth.password) {
      sessionStorage.setItem(auth.sessionKey, 'yes');
      onLogin();
      return;
    }
    setError('密码不对，再确认一下。');
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="small-label">{site.student.name} 的学习入口</p>
        <h1>{site.title}</h1>
        <p>{site.subtitle}</p>
        <form onSubmit={submit} className="login-form">
          <label htmlFor="password">输入学习密码</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
            autoComplete="current-password"
          />
          {error ? <p className="error">{error}</p> : null}
          <button type="submit">进入学习门户</button>
        </form>
        <p className="hint">这是本地轻量访问门，适合家庭本机使用。</p>
      </section>
    </main>
  );
}

function Header({ site, auth, onLogout }) {
  return (
    <header className="app-header">
      <div>
        <p className="small-label">{site.student.grade}</p>
        <h1>{site.title}</h1>
      </div>
      <button
        type="button"
        className="ghost-button"
        onClick={() => {
          sessionStorage.removeItem(auth.sessionKey);
          onLogout();
        }}
      >
        退出
      </button>
    </header>
  );
}

function PortalHero({ index }) {
  const rawFileCount = index.materialGroups.reduce((total, material) => total + (material.rawFiles?.length ?? 0), 0);

  return (
    <section className="portal-hero">
      <div>
        <h2>{index.portal.title}</h2>
        <p>{index.portal.intro}</p>
      </div>
      <div className="hero-stats" aria-label="门户当前内容统计">
        <div>
          <strong>{index.materialGroups.length}</strong>
          <span>份已分析素材</span>
        </div>
        <div>
          <strong>{rawFileCount}</strong>
          <span>个原始资料入口</span>
        </div>
        <div>
          <strong>{index.knowledgePlans.length}</strong>
          <span>个提升知识点</span>
        </div>
      </div>
    </section>
  );
}

function FileLinks({ files, emptyText }) {
  if (!files?.length) {
    return <p className="quiet-text">{emptyText}</p>;
  }

  return (
    <div className="link-row">
      {files.map((file) => (
        <a href={materialUrl(file.source)} key={`${file.label}-${file.source}`} target="_blank" rel="noreferrer">
          {file.label}
        </a>
      ))}
    </div>
  );
}

function MiniList({ title, items }) {
  if (!items?.length) return null;

  return (
    <div className="mini-list">
      <h5>{title}</h5>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function MaterialCard({ material, subjects }) {
  const cover = material.rawFiles?.find((file) => /\.(jpg|jpeg|png|webp)$/i.test(file.source));
  const analysis = material.analysis ?? {
    file: '',
    summary: '暂未生成系统分析。',
    strengths: [],
    needsImprovement: []
  };

  return (
    <article className={`material-card ${subjectTone(subjects, material.subject)}`} id={`material-${material.id}`}>
      {cover ? (
        <a className="thumb-wrap" href={materialUrl(cover.source)} target="_blank" rel="noreferrer">
          <img src={materialUrl(cover.source)} alt={`${material.title} ${cover.label}`} />
        </a>
      ) : (
        <div className="thumb-placeholder">资料索引</div>
      )}
      <div className="material-body">
        <div className="card-meta">
          <span>{subjectLabel(subjects, material.subject)}</span>
          <span>{material.type}</span>
          <strong>{material.priority}</strong>
        </div>
        <h4>{material.title}</h4>
        <p>{material.summary}</p>
        <div className="material-columns">
          <div>
            <h5>原始素材</h5>
            <FileLinks files={material.rawFiles} emptyText="暂未接入原始素材。" />
          </div>
          <div>
            <h5>系统分析</h5>
            <p>{analysis.summary}</p>
            <FileLinks
              files={[
                ...(analysis.file
                  ? [
                      {
                        label: '诊断方案',
                        source: analysis.file
                      }
                    ]
                  : []),
                ...(material.learningLinks ?? [])
              ]}
              emptyText="暂未生成分析文件。"
            />
          </div>
        </div>
        <div className="insight-row">
          <MiniList title="做得好的地方" items={analysis.strengths} />
          <MiniList title="需要加强的地方" items={analysis.needsImprovement} />
        </div>
      </div>
    </article>
  );
}

function MaterialsSection({ index }) {
  const groups = groupBySubject(index.materialGroups, index.subjects);

  return (
    <section className="section-band" aria-labelledby="materials-title">
      <div className="section-heading">
        <p className="small-label">第一部分</p>
        <h3 id="materials-title">各科原始素材与系统分析</h3>
        <p>每份资料都保留原始素材入口，并连接到对应的诊断分析和 Leo 可阅读材料。</p>
      </div>
      <div className="subject-stack">
        {groups.map(({ subject, records }) => (
          <div className="subject-block" key={subject.id}>
            <div className="subject-title">
              <h4>{subject.label}</h4>
              <span>{records.length} 份资料</span>
            </div>
            {records.length ? (
              <div className="material-list">
                {records.map((material) => (
                  <MaterialCard key={material.id} material={material} subjects={index.subjects} />
                ))}
              </div>
            ) : (
              <p className="empty-state">这个科目还没有接入门户资料。</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function KnowledgeCard({ plan, materials, subjects }) {
  const evidenceMaterials = (plan.evidenceMaterialIds ?? [])
    .map((id) => materials.find((material) => material.id === id))
    .filter(Boolean);

  return (
    <article className={`knowledge-card ${subjectTone(subjects, plan.subject)}`}>
      <div className="card-meta">
        <span>{subjectLabel(subjects, plan.subject)}</span>
        <strong>{plan.priority}</strong>
      </div>
      <h4>{plan.title}</h4>
      <p>{plan.reason}</p>
      <div className="goal-box">{plan.goal}</div>
      <div className="practice-area">
        <h5>对应习题文件</h5>
        <FileLinks files={plan.practiceFiles} emptyText="暂未生成习题文件。" />
      </div>
      <MiniList title="做到这些就算过关" items={plan.checkpoints} />
      {evidenceMaterials.length ? (
        <div className="evidence-links">
          <h5>来自哪些原始素材</h5>
          <div className="link-row">
            {evidenceMaterials.map((material) => (
              <a key={material.id} href={`#material-${material.id}`}>
                {material.title}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function KnowledgeSection({ index }) {
  const groups = groupBySubject(index.knowledgePlans, index.subjects);

  return (
    <section className="section-band" aria-labelledby="knowledge-title">
      <div className="section-heading">
        <p className="small-label">第二部分</p>
        <h3 id="knowledge-title">分科知识点提升清单</h3>
        <p>每个知识点都能追溯到原始素材，并连接一个可以直接练的习题文件。</p>
      </div>
      <div className="knowledge-board">
        {groups.map(({ subject, records }) => (
          <div className="knowledge-column" key={subject.id}>
            <div className="subject-title">
              <h4>{subject.label}</h4>
              <span>{records.length} 个知识点</span>
            </div>
            {records.length ? (
              records.map((plan) => (
                <KnowledgeCard key={plan.id} plan={plan} materials={index.materialGroups} subjects={index.subjects} />
              ))
            ) : (
              <p className="empty-state">这个科目暂时没有专项提升任务。</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function DirectoryModel({ subjects }) {
  return (
    <section className="section-band compact-band" aria-labelledby="directory-title">
      <div className="section-heading">
        <p className="small-label">资料管理方式</p>
        <h3 id="directory-title">每个科目分成三层</h3>
      </div>
      <div className="directory-grid">
        {subjects.map((subject) => (
          <article className="directory-card" key={subject.id}>
            <h4>{subject.label}</h4>
            <p>原始素材：{subject.directories.raw}</p>
            <p>教学分析：{subject.directories.analysis}</p>
            <p>提升习题：{subject.directories.practice}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Dashboard({ site, auth, index, onLogout }) {
  return (
    <main className="app-shell">
      <Header site={site} auth={auth} onLogout={onLogout} />
      <PortalHero index={index} />
      <MaterialsSection index={index} />
      <KnowledgeSection index={index} />
      <DirectoryModel subjects={index.subjects} />
    </main>
  );
}

function App() {
  const [state, setState] = useState({ status: 'loading' });
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [site, auth, index] = await Promise.all([
          loadJson(CONFIG_PATHS.site),
          loadJson(CONFIG_PATHS.auth),
          loadJson(CONFIG_PATHS.index)
        ]);
        setAuthenticated(sessionStorage.getItem(auth.sessionKey) === 'yes');
        setState({ status: 'ready', site, auth, index });
      } catch (error) {
        setState({ status: 'error', message: error.message });
      }
    }

    load();
  }, []);

  const readyState = useMemo(() => state, [state]);

  if (readyState.status === 'loading') {
    return <main className="loading">正在打开 Leo 学习门户...</main>;
  }

  if (readyState.status === 'error') {
    return <main className="loading error">{readyState.message}</main>;
  }

  if (!authenticated) {
    return <LoginView site={readyState.site} auth={readyState.auth} onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <Dashboard
      site={readyState.site}
      auth={readyState.auth}
      index={readyState.index}
      onLogout={() => setAuthenticated(false)}
    />
  );
}

createRoot(document.getElementById('root')).render(<App />);

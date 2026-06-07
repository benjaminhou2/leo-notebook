import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LogIn } from 'lucide-react';
import { AppShell } from './components/AppShell.jsx';
import { Button, ErrorNotice, Loading } from './components/Common.jsx';
import DashboardPage from './features/dashboard/DashboardPage.jsx';
import './styles.css';

const MaterialsPage = lazy(() => import('./features/materials/MaterialsPage.jsx'));
const KnowledgePage = lazy(() => import('./features/knowledge/KnowledgePage.jsx'));
const TrainingPage = lazy(() => import('./features/training/TrainingPage.jsx'));
const ReportsPage = lazy(() => import('./features/reports/ReportsPage.jsx'));
const ConfigPage = lazy(() => import('./features/config/ConfigPage.jsx'));
const StudentPage = lazy(() => import('./features/student/StudentPage.jsx'));

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`无法读取 ${path}`);
  return response.json();
}

function LoginView({ site, auth, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (auth.mode === 'mysql') {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || '用户名或密码错误。');
      } else if (password !== auth.password) {
        throw new Error('密码不正确。');
      }
      sessionStorage.setItem(auth.sessionKey, 'yes');
      onLogin();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="login-brand"><span>L</span><div><strong>Leo 学习系统</strong><small>{site.student.grade}</small></div></div>
        <div className="login-copy"><p>家庭本地学习工作台</p><h1>把每一份作业，变成下一步真正有用的学习行动。</h1><span>素材证据、薄弱点、两轮训练和复习计划都集中在这里。</span></div>
        <form onSubmit={submit}>
          {auth.mode === 'mysql' ? <label>用户名<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoFocus /></label> : null}
          <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" autoFocus={auth.mode !== 'mysql'} /></label>
          <ErrorNotice message={error} />
          <Button icon={LogIn} disabled={busy}>{busy ? '正在进入...' : '进入学习系统'}</Button>
        </form>
      </section>
    </main>
  );
}

function App() {
  const [config, setConfig] = useState({ loading: true, site: null, auth: null, error: '' });
  const [authenticated, setAuthenticated] = useState(false);
  const [mode, setMode] = useState('parent');
  const [page, setPage] = useState('dashboard');
  const [routeState, setRouteState] = useState({});
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    Promise.all([loadJson('/config/site.json'), loadJson('/config/auth.json')])
      .then(([site, auth]) => {
        setConfig({ loading: false, site, auth, error: '' });
        setAuthenticated(sessionStorage.getItem(auth.sessionKey) === 'yes');
      })
      .catch((error) => setConfig({ loading: false, site: null, auth: null, error: error.message }));
  }, []);

  function navigate(nextPage, state = {}, nextMode = mode) {
    setMode(nextMode);
    setPage(nextPage);
    setRouteState(state);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (config.loading) return <Loading label="正在启动 Leo 学习系统..." />;
  if (config.error) return <main className="login-shell"><ErrorNotice message={config.error} /></main>;
  if (!authenticated) return <LoginView site={config.site} auth={config.auth} onLogin={() => setAuthenticated(true)} />;

  let content;
  if (mode === 'student') {
    content = <StudentPage page={page} onPageChange={setPage} />;
  } else if (page === 'materials') {
    content = <MaterialsPage initialState={routeState} clearInitialState={() => setRouteState({})} onDataChanged={() => setDataVersion((value) => value + 1)} />;
  } else if (page === 'knowledge') {
    content = <KnowledgePage initialState={routeState} clearInitialState={() => setRouteState({})} navigate={navigate} />;
  } else if (page === 'training') {
    content = <TrainingPage initialState={routeState} clearInitialState={() => setRouteState({})} />;
  } else if (page === 'reports') {
    content = <ReportsPage />;
  } else if (page === 'config') {
    content = <ConfigPage initialState={routeState} clearInitialState={() => setRouteState({})} />;
  } else {
    content = <DashboardPage key={dataVersion} navigate={navigate} />;
  }

  return (
    <AppShell
      site={config.site}
      mode={mode}
      onModeChange={(nextMode) => {
        setMode(nextMode);
        setRouteState({});
      }}
      page={page}
      onPageChange={(nextPage) => {
        setPage(nextPage);
        setRouteState({});
      }}
      onLogout={() => {
        sessionStorage.removeItem(config.auth.sessionKey);
        setAuthenticated(false);
      }}
    >
      <Suspense fallback={<Loading label="正在打开页面..." />}>{content}</Suspense>
    </AppShell>
  );
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);

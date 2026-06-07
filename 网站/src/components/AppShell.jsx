import React from 'react';
import {
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  ClipboardList,
  Database,
  FileStack,
  GraduationCap,
  Home,
  LogOut,
  Settings2
} from 'lucide-react';
import { IconButton, Segmented } from './Common.jsx';

const parentItems = [
  { id: 'dashboard', label: '工作台', icon: Home },
  { id: 'materials', label: '素材中心', icon: FileStack },
  { id: 'knowledge', label: '知识画像', icon: BrainCircuit },
  { id: 'training', label: '训练与复习', icon: ClipboardList },
  { id: 'reports', label: '学习报告', icon: BarChart3 },
  { id: 'config', label: '智能配置', icon: Settings2 }
];

const studentItems = [
  { id: 'today', label: '今日学习', icon: BookOpenCheck },
  { id: 'explanations', label: '错题讲解', icon: GraduationCap },
  { id: 'reviews', label: '到期复习', icon: ClipboardList },
  { id: 'progress', label: '我的进步', icon: BarChart3 }
];

export function AppShell({
  site,
  mode,
  onModeChange,
  page,
  onPageChange,
  onLogout,
  children
}) {
  const items = mode === 'parent' ? parentItems : studentItems;
  function changeMode(nextMode) {
    onModeChange(nextMode);
    onPageChange(nextMode === 'parent' ? 'dashboard' : 'today');
  }
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Database size={20} /></div>
          <div>
            <strong>Leo 学习系统</strong>
            <span>{site.student.grade}</span>
          </div>
        </div>

        <Segmented
          value={mode}
          onChange={changeMode}
          ariaLabel="切换使用模式"
          options={[
            { value: 'parent', label: '家长端' },
            { value: 'student', label: 'Leo端' }
          ]}
        />

        <nav className="side-nav" aria-label={mode === 'parent' ? '家长端导航' : 'Leo端导航'}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                className={page === item.id ? 'active' : ''}
                onClick={() => onPageChange(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div>
            <strong>{site.student.name}</strong>
            <span>{mode === 'parent' ? '家长管理模式' : '专注学习模式'}</span>
          </div>
          <IconButton icon={LogOut} label="退出登录" onClick={onLogout} />
        </div>
      </aside>
      <main className="main-area">
        <div className="mobile-mode-switch">
          <strong>Leo 学习系统</strong>
          <Segmented
            value={mode}
            onChange={changeMode}
            ariaLabel="手机端切换使用模式"
            options={[
              { value: 'parent', label: '家长端' },
              { value: 'student', label: 'Leo端' }
            ]}
          />
        </div>
        {children}
      </main>
    </div>
  );
}

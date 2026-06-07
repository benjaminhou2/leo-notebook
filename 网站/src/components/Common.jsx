import React from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  X
} from 'lucide-react';
import { statusName, subjectName } from '../api.js';

export function Button({
  children,
  icon: Icon,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) {
  return (
    <button className={`button button-${variant} button-${size} ${className}`} {...props}>
      {Icon ? <Icon size={size === 'sm' ? 15 : 17} aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

export function IconButton({ icon: Icon, label, variant = 'ghost', ...props }) {
  return (
    <button className={`icon-button icon-button-${variant}`} type="button" title={label} aria-label={label} {...props}>
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}

export function Status({ value, tone }) {
  const resolvedTone = tone || (
    ['confirmed', 'completed', 'mastered', 'healthy', 'published', 'accepted'].includes(value)
      ? 'success'
      : ['failed', 'analysis_failed', 'processing_failed', 'error', 'rejected'].includes(value)
        ? 'danger'
        : ['pending_review', 'needs_review', 'persistent', 'P0'].includes(value)
          ? 'warning'
          : 'neutral'
  );
  return <span className={`status status-${resolvedTone}`}>{statusName(value)}</span>;
}

export function SubjectMark({ subject, compact = false }) {
  return (
    <span className={`subject-mark subject-${subject} ${compact ? 'subject-mark-compact' : ''}`}>
      {subjectName(subject)}
    </span>
  );
}

export function Progress({ value = 0, label, tone = 'sky' }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="progress-wrap">
      {label ? <div className="progress-label"><span>{label}</span><strong>{Math.round(safeValue)}%</strong></div> : null}
      <div className="progress-track"><span className={`progress-fill progress-${tone}`} style={{ width: `${safeValue}%` }} /></div>
    </div>
  );
}

export function EmptyState({ title, detail, action }) {
  return (
    <div className="empty-state">
      <CircleAlert size={24} aria-hidden="true" />
      <strong>{title}</strong>
      {detail ? <p>{detail}</p> : null}
      {action}
    </div>
  );
}

export function Loading({ label = '正在加载...' }) {
  return <div className="loading-state"><LoaderCircle className="spin" size={20} /><span>{label}</span></div>;
}

export function ErrorNotice({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="notice notice-danger">
      <AlertTriangle size={18} />
      <span>{message}</span>
      {onRetry ? <button type="button" onClick={onRetry}>重试</button> : null}
    </div>
  );
}

export function Notice({ children, tone = 'info' }) {
  return <div className={`notice notice-${tone}`}>{tone === 'success' ? <Check size={18} /> : <CircleAlert size={18} />}<span>{children}</span></div>;
}

export function Modal({ title, onClose, children, footer, size = 'md' }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h2>{title}</h2>
          <IconButton icon={X} label="关闭" onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}

export function Drawer({ title, onClose, children, footer }) {
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h2>{title}</h2>
          <IconButton icon={X} label="关闭" onClick={onClose} />
        </header>
        <div className="drawer-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </aside>
    </div>
  );
}

export function ExpandButton({ expanded, label, ...props }) {
  return (
    <button type="button" className="expand-button" aria-expanded={expanded} {...props}>
      {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      <span>{label}</span>
    </button>
  );
}

export function Field({ label, hint, required, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}{required ? <b>*</b> : null}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function Segmented({ value, onChange, options, ariaLabel }) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={value === option.value ? 'active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function PageHeading({ title, detail, actions, eyebrow }) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow ? <p>{eyebrow}</p> : null}
        <h1>{title}</h1>
        {detail ? <span>{detail}</span> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

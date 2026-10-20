import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AlertCircle, Check, Info, X } from 'lucide-react';
import { useApp } from '@/app/AppContext';

export function Button({ tone = 'primary', size = 'md', className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg' }) {
  return <button className={`button button-${tone} button-${size} ${className}`} {...props}>{children}</button>;
}

export function IconButton({ label, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" aria-label={label} title={label} className={`icon-button ${className}`} {...props} />;
}

export function Card({ children, className = '', as = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  const Tag = as;
  return <Tag className={`card ${className}`}>{children}</Tag>;
}

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="page-header">
    <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle && <p className="page-subtitle">{subtitle}</p>}</div>
    {action && <div className="page-header-action">{action}</div>}
  </div>;
}

let activeModalCount = 0;
let originalBodyOverflow = '';

function acquireScrollLock() {
  if (typeof document === 'undefined') return;
  if (activeModalCount === 0) {
    originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  activeModalCount++;
}

function releaseScrollLock() {
  if (typeof document === 'undefined') return;
  activeModalCount = Math.max(0, activeModalCount - 1);
  if (activeModalCount === 0) {
    document.body.style.overflow = originalBodyOverflow;
  }
}

export function Modal({ open, onClose, title, subtitle, children, wide = false, panelClassName = '', backdropClassName = '', footer }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; wide?: boolean; panelClassName?: string; backdropClassName?: string; footer?: ReactNode }) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    acquireScrollLock();
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []).filter((element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true');
    const frame = window.requestAnimationFrame(() => (focusable()[0] ?? dialog)?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); onCloseRef.current(); return; }
      if (event.key !== 'Tab' || !dialog) return;
      const controls = focusable();
      if (!controls.length) { event.preventDefault(); dialog.focus(); return; }
      const first = controls[0];
      const last = controls[controls.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (active === last || !dialog.contains(active))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey, true);
      releaseScrollLock();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);
  if (!open) return null;
  return <div className={`modal-backdrop ${backdropClassName}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={subtitle ? descriptionId : undefined} className={`modal-panel ${wide ? 'modal-wide' : ''} ${panelClassName}`}>
      <header className="modal-header"><div><h2 id={titleId}>{title}</h2>{subtitle && <p id={descriptionId}>{subtitle}</p>}</div><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></header>
      <div className="modal-content">{children}</div>
      {footer && <footer className="modal-footer">{footer}</footer>}
    </section>
  </div>;
}

export function ProgressBar({ value, target, tone = 'green' }: { value: number; target: number; tone?: 'green' | 'coral' | 'gold' | 'blue' }) {
  const progress = target > 0 ? Math.min(100, Math.max(0, (value / target) * 100)) : 0;
  return <div className={`progress-track progress-${tone}`} role="progressbar" aria-valuenow={target > 0 ? Math.min(target, Math.max(0, Math.round(value))) : 0} aria-valuemin={0} aria-valuemax={target} aria-valuetext={`${Math.round(value)} of ${Math.round(target)}`} aria-label={`${Math.round(value)} of ${Math.round(target)}`}><span style={{ width: `${progress}%` }} /></div>;
}

export function RingProgress({ value, target, label, sublabel }: { value: number; target: number; label: string; sublabel: string }) {
  const safeTarget = Number.isFinite(target) ? Math.max(0, target) : 0;
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  const percent = safeTarget > 0 ? Math.min(1, safeValue / safeTarget) : 0;
  const progressValue = safeTarget > 0 ? Math.min(safeTarget, safeValue) : 0;
  const degrees = percent * 360;
  const valueText = safeTarget > 0
    ? `${Math.round(safeValue)} of ${Math.round(safeTarget)} calories; ${Math.round(percent * 100)}% of daily target`
    : 'No calorie target set';
  return <div className="ring-wrap" role="progressbar" aria-label="Daily calorie progress" aria-valuemin={0} aria-valuemax={Math.max(1, safeTarget)} aria-valuenow={Math.round(progressValue)} aria-valuetext={valueText}>
    <div className="ring-progress" style={{ background: `conic-gradient(#244c3a ${degrees}deg, #e9eee6 ${degrees}deg)` }}>
      <div className="ring-inner"><span className="ring-kicker">{label}</span><strong>{sublabel}</strong><span className="ring-caption">kcal</span></div>
    </div>
  </div>;
}

export function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'coral' }) {
  return <span className={`status-pill pill-${tone}`}>{children}</span>;
}

export function EmptyState({ icon, title, detail, action }: { icon?: ReactNode; title: string; detail: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon ?? <Info size={20} />}</div><h3>{title}</h3><p>{detail}</p>{action}</div>;
}

export function FieldError({ children }: { children?: ReactNode }) {
  return children ? <span className="field-error">{children}</span> : null;
}

export function GlobalFeedback() {
  const { confirm, closeConfirm, toasts, removeToast } = useApp();
  return <>
    {confirm && <Modal open onClose={closeConfirm} title={confirm.title} subtitle="This action cannot be undone.">
      <p className="confirm-copy">{confirm.message}</p><div className="modal-actions"><Button tone="secondary" onClick={closeConfirm}>Cancel</Button><Button tone="danger" onClick={() => { confirm.onConfirm(); closeConfirm(); }}>{confirm.confirmLabel ?? 'Delete'}</Button></div>
    </Modal>}
    <div className="toast-stack" aria-live="polite" aria-atomic="false">{toasts.map((toast) => <div key={toast.id} className={`toast toast-${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
      <span className="toast-icon">{toast.tone === 'success' ? <Check size={16} /> : toast.tone === 'error' ? <AlertCircle size={16} /> : <Info size={16} />}</span><div><strong>{toast.title}</strong>{toast.detail && <p>{toast.detail}</p>}</div><button type="button" aria-label="Dismiss notification" onClick={() => removeToast(toast.id)}><X size={15} /></button>
    </div>)}</div>
  </>;
}

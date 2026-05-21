/* eslint-disable react-refresh/only-export-components */
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import clsx from 'clsx'
import { AlertTriangle, CheckCircle2, Search, X } from 'lucide-react'

type Toast = { id: string; type: 'success' | 'error' | 'info'; title: string; message?: string }

const ToastContext = createContext<{ push: (toast: Omit<Toast, 'id'>) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID()
    setToasts((items) => [...items, { ...toast, id }])
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3600)
  }, [])
  const value = useMemo(() => ({ push }), [push])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div className={clsx('toast', toast.type)} key={toast.id}>
            {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <div>
              <strong>{toast.title}</strong>
              {toast.message ? <span>{toast.message}</span> : null}
            </div>
            <button aria-label="Fechar aviso" onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}

export function Button({ className, variant = 'primary', loading, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean }) {
  return (
    <button className={clsx('btn', variant, className)} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="spinner" /> : null}
      {children}
    </button>
  )
}

export function IconButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={clsx('icon-btn', className)} {...props}>
      {children}
    </button>
  )
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="input textarea" {...props} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input select" {...props} />
}

export function Badge({ children, color = 'gray' }: { children: ReactNode; color?: string }) {
  return (
    <span className="badge" style={{ ['--badge' as string]: color }}>
      {children}
    </span>
  )
}

export function Modal({ title, open, onClose, children, footer }: { title: string; open: boolean; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null
  return (
    <div className="overlay" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <IconButton aria-label="Fechar modal" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-foot">{footer}</footer> : null}
      </section>
    </div>
  )
}

export function Drawer({ title, open, onClose, children, width = 420 }: { title: string; open: boolean; onClose: () => void; children: ReactNode; width?: number }) {
  if (!open) return null
  return (
    <div className="overlay drawer-overlay" role="presentation">
      <aside className="drawer" style={{ width }} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <IconButton aria-label="Fechar painel" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  )
}

export function ConfirmDialog({ open, title, description, confirmText = 'Confirmar', onCancel, onConfirm, danger }: { open: boolean; title: string; description: string; confirmText?: string; onCancel: () => void; onConfirm: () => void; danger?: boolean }) {
  return (
    <Modal
      title={title}
      open={open}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmText}</Button>
        </>
      }
    >
      <p className="muted">{description}</p>
    </Modal>
  )
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function StatCard({ label, value, icon, accent }: { label: string; value: ReactNode; icon?: ReactNode; accent?: string }) {
  return (
    <article className="stat-card" style={{ ['--accent' as string]: accent || '#ef5a3c' }}>
      <span>{label}</span>
      <strong>{value}</strong>
      {icon ? <div className="stat-icon">{icon}</div> : null}
    </article>
  )
}

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="chart-card">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <div className="searchbar">
      <Search size={18} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}

export function DataTable({ columns, rows }: { columns: string[]; rows: Array<Record<string, ReactNode>> }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id || index)}>
              {columns.map((column) => <td key={column}>{row[column]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Skeleton() {
  return (
    <div className="skeleton-page">
      <span />
      <span />
      <span />
    </div>
  )
}

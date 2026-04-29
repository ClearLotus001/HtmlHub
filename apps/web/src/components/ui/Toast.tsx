'use client';

import * as React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

/* ==================== 类型定义 ==================== */

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue>({
  toasts: [],
  addToast: () => '',
  removeToast: () => {},
});

export function useToast() {
  return React.useContext(ToastContext);
}

/* ==================== 语义色映射 ==================== */

const toastTones = {
  success: {
    icon: CheckCircle2,
    iconClass: 'text-success',
    borderClass: 'border-l-success',
    bgClass: 'bg-success/10',
  },
  error: {
    icon: AlertCircle,
    iconClass: 'text-destructive',
    borderClass: 'border-l-destructive',
    bgClass: 'bg-destructive/10',
  },
  info: {
    icon: Info,
    iconClass: 'text-info',
    borderClass: 'border-l-info',
    bgClass: 'bg-info/10',
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'text-warning',
    borderClass: 'border-l-warning',
    bgClass: 'bg-warning/10',
  },
} satisfies Record<ToastType, {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  borderClass: string;
  bgClass: string;
}>;

/* ==================== Provider ==================== */

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = crypto.randomUUID();
    const newToast: Toast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    // 自动消失
    const duration = toast.duration ?? 3500;
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);

    return id;
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          aria-atomic="false"
          className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex w-full max-w-sm flex-col gap-3"
        >
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

/* ==================== 单条 Toast ==================== */

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [leaving, setLeaving] = React.useState(false);
  const tone = toastTones[toast.type];
  const Icon = tone.icon;

  const handleClose = () => {
    setLeaving(true);
    window.setTimeout(onClose, 200);
  };

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border border-l-4 border-border bg-popover p-4 text-popover-foreground shadow-lg backdrop-blur-xl transition-all duration-200 animate-slide-in-right ${tone.borderClass} ${tone.bgClass} ${leaving ? 'translate-x-8 opacity-0' : ''}`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${tone.iconClass}`} />
      <div className="min-w-0 flex-1">
        {toast.title && (
          <p className="text-[13px] font-semibold text-popover-foreground">{toast.title}</p>
        )}
        <p className="break-words text-[12px] leading-relaxed text-muted-foreground">{toast.message}</p>
      </div>
      <button
        type="button"
        aria-label="关闭通知"
        onClick={handleClose}
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

'use client';

import * as React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

/* ==================== Dialog 弹窗 ==================== */

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  actions?: React.ReactNode;
  closeOnOverlayClick?: boolean;
  /** 标题右侧的图标节点 */
  icon?: React.ReactNode;
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  actions,
  closeOnOverlayClick = true,
  icon,
}: DialogProps) {
  const [leaving, setLeaving] = React.useState(false);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const lastActiveRef = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  const handleClose = React.useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => {
      setLeaving(false);
      onClose();
    }, 160);
  }, [onClose]);

  React.useEffect(() => {
    if (!open) return;

    lastActiveRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>(focusableSelector);
    window.setTimeout(() => {
      (focusable || dialog)?.focus();
    }, 0);

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }

      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusableNodes = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((node) => node.offsetParent !== null || node === document.activeElement);

      if (focusableNodes.length === 0) {
        e.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusableNodes[0];
      const last = focusableNodes[focusableNodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handler);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = previousOverflow;
      lastActiveRef.current?.focus();
    };
  }, [open, handleClose]);

  if (!open) return null;

  const sizeMap: Record<NonNullable<DialogProps['size']>, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-foreground/45 backdrop-blur-sm transition-opacity duration-200 ${leaving ? 'opacity-0' : 'opacity-100'}`}
        onClick={closeOnOverlayClick ? handleClose : undefined}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`relative z-10 w-full ${sizeMap[size]} animate-macos-scale-in rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl transition-all duration-200 ${leaving ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-2">
          <div className="flex items-center gap-2.5">
            {icon && <span className="shrink-0">{icon}</span>}
            <div>
              {title && <h3 id={titleId} className="text-[16px] font-semibold text-popover-foreground">{title}</h3>}
              {description && (
                <p id={descriptionId} className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭弹窗"
            onClick={handleClose}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 pt-2">{children}</div>
        {actions && <div className="flex items-center justify-end gap-2.5 px-5 pb-5 pt-1">{actions}</div>}
      </div>
    </div>
  );
}

/* ==================== Provider 化 Alert / Confirm ==================== */

export interface AlertDialogOptions {
  type?: 'info' | 'success' | 'error' | 'warning';
  title?: string;
}

type DialogRequest =
  | {
      kind: 'alert';
      message: string;
      options?: AlertDialogOptions;
      resolve: () => void;
    }
  | {
      kind: 'confirm';
      message: string;
      options?: { title?: string };
      resolve: (value: boolean) => void;
    };

interface DialogContextValue {
  alert: (message: string, options?: AlertDialogOptions) => Promise<void>;
  confirm: (message: string, options?: { title?: string }) => Promise<boolean>;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);
let externalDialogApi: DialogContextValue | null = null;

export function useDialog() {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error('useDialog 必须在 DialogProvider 内使用');
  return ctx;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = React.useState<DialogRequest[]>([]);
  const current = queue[0] ?? null;

  const closeCurrent = React.useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  const alert = React.useCallback((message: string, options?: AlertDialogOptions) => {
    return new Promise<void>((resolve) => {
      setQueue((prev) => [...prev, { kind: 'alert', message, options, resolve }]);
    });
  }, []);

  const confirm = React.useCallback((message: string, options?: { title?: string }) => {
    return new Promise<boolean>((resolve) => {
      setQueue((prev) => [...prev, { kind: 'confirm', message, options, resolve }]);
    });
  }, []);

  const value = React.useMemo(() => ({ alert, confirm }), [alert, confirm]);

  React.useEffect(() => {
    externalDialogApi = value;
    return () => {
      if (externalDialogApi === value) externalDialogApi = null;
    };
  }, [value]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      {current?.kind === 'alert' && (
        <AlertDialogComp
          request={current}
          onConfirm={() => {
            current.resolve();
            closeCurrent();
          }}
          onClose={() => {
            current.resolve();
            closeCurrent();
          }}
        />
      )}
      {current?.kind === 'confirm' && (
        <ConfirmComp
          request={current}
          onOk={() => {
            current.resolve(true);
            closeCurrent();
          }}
          onCancel={() => {
            current.resolve(false);
            closeCurrent();
          }}
        />
      )}
    </DialogContext.Provider>
  );
}

export async function alertDialog(message: string, options?: AlertDialogOptions): Promise<void> {
  if (!externalDialogApi) {
    window.alert(message);
    return;
  }
  return externalDialogApi.alert(message, options);
}

export function confirmDialog(message: string, options?: { title?: string }): Promise<boolean> {
  if (!externalDialogApi) {
    return Promise.resolve(window.confirm(message));
  }
  return externalDialogApi.confirm(message, options);
}

function AlertDialogComp({
  request,
  onConfirm,
  onClose,
}: {
  request: Extract<DialogRequest, { kind: 'alert' }>;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const type = request.options?.type ?? 'info';
  const tone = alertTones[type];
  const Icon = tone.icon;

  return (
    <Dialog
      open
      onClose={onClose}
      title={request.options?.title || tone.defaultTitle}
      size="sm"
    >
      <div className="py-2">
        <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-muted-foreground">
          {request.message}
        </p>
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.97]"
        >
          确定
        </button>
      </div>
    </Dialog>
  );
}

function ConfirmComp({
  request,
  onOk,
  onCancel,
}: {
  request: Extract<DialogRequest, { kind: 'confirm' }>;
  onOk: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open
      onClose={onCancel}
      title={request.options?.title || '确认操作'}
      size="sm"
      closeOnOverlayClick={false}
    >
      <div className="py-2">
        <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-muted-foreground">
          {request.message}
        </p>
      </div>
      <div className="mt-2 flex justify-end gap-2.5">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center justify-center rounded-xl border border-border px-4 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground active:scale-[0.97]"
        >
          取消
        </button>
        <button
          type="button"
          onClick={onOk}
          className="inline-flex h-9 items-center justify-center rounded-xl bg-destructive px-4 text-[13px] font-semibold text-destructive-foreground shadow-sm transition-all hover:brightness-110 active:scale-[0.97]"
        >
          确认
        </button>
      </div>
    </Dialog>
  );
}

const alertTones = {
  info: {
    icon: Info,
    bg: 'bg-info/15',
    text: 'text-info',
    defaultTitle: '提示',
  },
  success: {
    icon: CheckCircle2,
    bg: 'bg-success/15',
    text: 'text-success',
    defaultTitle: '操作成功',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-destructive/15',
    text: 'text-destructive',
    defaultTitle: '操作失败',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-warning/15',
    text: 'text-warning',
    defaultTitle: '请注意',
  },
} satisfies Record<NonNullable<AlertDialogOptions['type']>, {
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  text: string;
  defaultTitle: string;
}>;

import React from 'react';
import { useUIStore } from '../../stores/useUIStore.js';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notificações"
      aria-live="polite"
      className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-3 z-50 flex max-w-sm flex-col gap-2.5 pointer-events-none sm:bottom-5 sm:left-auto sm:right-5 sm:w-full"
    >
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle2 className="w-5 h-5 text-gdisc-success shrink-0" />,
          error: <AlertCircle className="w-5 h-5 text-gdisc-danger shrink-0" />,
          info: <Info className="w-5 h-5 text-gdisc-brand-secondary shrink-0" />,
        };

        const borders = {
          success: 'border-gdisc-success/30 bg-gdisc-bg-card',
          error: 'border-gdisc-danger/30 bg-gdisc-bg-card',
          info: 'border-gdisc-brand-primary/30 bg-gdisc-bg-card',
        };

        return (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl border shadow-xl animate-fade-in ${borders[toast.type]}`}
          >
            <div className="flex items-center gap-3 text-sm text-gdisc-text-primary">
              {icons[toast.type]}
              <span>{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Fechar notificação"
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-gdisc-text-muted hover:bg-gdisc-bg-hover hover:text-gdisc-text-primary sm:min-h-9 sm:min-w-9"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

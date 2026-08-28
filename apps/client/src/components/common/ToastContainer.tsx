import React from 'react';
import { useUIStore } from '../../stores/useUIStore.js';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
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
            className={`pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl border shadow-xl animate-fade-in ${borders[toast.type]}`}
          >
            <div className="flex items-center gap-3 text-sm text-gdisc-text-primary">
              {icons[toast.type]}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gdisc-text-muted hover:text-gdisc-text-primary p-1 rounded-md hover:bg-gdisc-bg-hover"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

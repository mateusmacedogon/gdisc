import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity animate-fade-in"
      />

      {/* Dialog Box */}
      <div
        className={`relative w-full ${maxWidthClasses[maxWidth]} bg-gdisc-bg-card border border-gdisc-bg-hover rounded-2xl shadow-2xl overflow-hidden z-10 animate-scale-in text-gdisc-text-primary`}
      >
        {/* Header */}
        {(title || description) && (
          <div className="px-6 pt-6 pb-4 flex items-start justify-between border-b border-gdisc-bg-hover/60">
            <div>
              {title && <h2 className="text-xl font-bold tracking-tight text-gdisc-text-primary">{title}</h2>}
              {description && <p className="text-xs text-gdisc-text-secondary mt-1">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="text-gdisc-text-muted hover:text-gdisc-text-primary p-1.5 rounded-lg hover:bg-gdisc-bg-hover transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

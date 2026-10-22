'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full px-4 pointer-events-none">
      {toasts.map((toast) => {
        return (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
        );
      })}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: () => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <XCircle className="w-5 h-5 text-rose-500 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-cyan-400 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-500/40 bg-[#0d2218]/95 shadow-[0_0_20px_rgba(16,185,129,0.25)]',
    error: 'border-rose-500/40 bg-[#250d12]/95 shadow-[0_0_20px_rgba(244,63,94,0.25)]',
    warning: 'border-amber-500/40 bg-[#261d09]/95 shadow-[0_0_20px_rgba(245,158,11,0.25)]',
    info: 'border-cyan-500/40 bg-[#0a1b24]/95 shadow-[0_0_20px_rgba(6,182,212,0.25)]',
  };

  return (
    <div
      className={`pointer-events-auto flex items-start justify-between gap-3 p-4 rounded-xl border backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-3 ${
        borders[toast.type]
      }`}
    >
      <div className="flex items-start gap-3">
        {icons[toast.type]}
        <div>
          <h4 className="text-sm font-bold text-white tracking-wide">{toast.title}</h4>
          {toast.message && (
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{toast.message}</p>
          )}
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

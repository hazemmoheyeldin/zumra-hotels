import React from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'standard' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'standard', onConfirm, onCancel
}: ConfirmDialogProps) {
  if (!open) return null;

  const isDestructive = variant === 'destructive';
  const confirmBtn = isDestructive
    ? 'bg-rose-600 hover:bg-rose-700 text-white'
    : 'bg-blue-600 hover:bg-blue-700 text-white';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-6 whitespace-pre-line leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm transition cursor-pointer min-h-[44px]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2.5 rounded-lg font-semibold text-sm transition cursor-pointer min-h-[44px] ${confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

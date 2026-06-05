import { useEffect, useState, useCallback } from 'react';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <ToastItem toast={t} onDismiss={onDismiss} key={t.id} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void; key?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const colors: Record<string, string> = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    warning: 'bg-amber-500 text-white',
    info: 'bg-blue-600 text-white',
  };

  return (
    <div
      className={`pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm transition-all duration-300 flex items-center gap-2 ${colors[toast.type]} ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
    >
      <span className="flex-1">{toast.text}</span>
      <button onClick={() => onDismiss(toast.id)} className="opacity-70 hover:opacity-100 text-lg leading-none cursor-pointer">&times;</button>
    </div>
  );
}

// Hook for managing toasts
let toastCounter = 0;
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((text: string, type: ToastMessage['type'] = 'info') => {
    const id = `toast_${++toastCounter}`;
    setToasts(prev => [...prev, { id, text, type }]);
  }, []);

  const success = useCallback((text: string) => addToast(text, 'success'), [addToast]);
  const error = useCallback((text: string) => addToast(text, 'error'), [addToast]);
  const warning = useCallback((text: string) => addToast(text, 'warning'), [addToast]);
  const info = useCallback((text: string) => addToast(text, 'info'), [addToast]);

  return { toasts, dismiss, success, error, warning, info, addToast };
}

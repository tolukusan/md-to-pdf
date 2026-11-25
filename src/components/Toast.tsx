export interface ToastMessage {
  id: number;
  text: string;
  tone?: 'info' | 'error';
  action?: { label: string; run: () => void };
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div className={`toast ${toast.tone === 'error' ? 'toast-error' : ''}`} key={toast.id}>
          <span>{toast.text}</span>
          {toast.action && (
            <button
              className="toast-action"
              onClick={() => {
                toast.action?.run();
                onDismiss();
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button className="toast-close" onClick={onDismiss} aria-label="Dismiss">×</button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

/**
 * Accessible confirmation dialog (replaces window.confirm).
 * tone: "danger" (red confirm button) or "primary".
 */
export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'danger', busy = false, onConfirm, onCancel }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    // Focus the safe choice first; Escape cancels.
    cancelRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div className="modal-backdrop confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section className={`request-modal confirm-dialog confirm-${tone}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
        <span className="confirm-dialog-icon" aria-hidden="true"><Icon name={tone === 'danger' ? 'alert' : 'check'} size={22} /></span>
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button ref={cancelRef} type="button" className="customer-outline-button" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={tone === 'danger' ? 'confirm-danger-button' : 'primary-button'} disabled={busy} onClick={onConfirm}>{busy ? 'Working…' : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

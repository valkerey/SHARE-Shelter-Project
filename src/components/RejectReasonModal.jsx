import { useState } from 'react';
import './SignInModal.css';

export default function RejectReasonModal({ open, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');

  if (!open) return null;

  return (
    <div
      className="signin-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-title"
    >
      <form
        className="signin-modal"
        onSubmit={(e) => {
          e.preventDefault();
          if (reason.trim()) onConfirm(reason.trim());
        }}
      >
        <h3 id="reject-title">Reject suggestion</h3>
        <div className="form-field">
          <label htmlFor="reject-reason">Reason</label>
          <input
            id="reject-reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Duplicate, out of scope, spam"
            autoFocus
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="signin-submit-btn" disabled={!reason.trim()}>
            Reject
          </button>
          <button type="button" className="signin-cancel-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

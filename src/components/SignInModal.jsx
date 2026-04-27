import { useState } from 'react';
import './SignInModal.css';

export default function SignInModal({ open, onSubmit, onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit(email, password);
      if (result?.error) {
        setError('Invalid email or password.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="signin-overlay" role="dialog" aria-modal="true">
      <form className="signin-modal" onSubmit={handleSubmit}>
        <h3>Admin sign in</h3>

        <div className="form-field">
          <label htmlFor="signin-email">Email</label>
          <input
            id="signin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="form-field">
          <label htmlFor="signin-password">Password</label>
          <input
            id="signin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <div className="signin-error">{error}</div>}

        <div className="form-actions">
          <button type="submit" className="signin-submit-btn" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
          <button type="button" className="signin-cancel-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

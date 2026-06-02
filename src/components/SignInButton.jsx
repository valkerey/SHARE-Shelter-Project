import { Lock, LogOut } from 'lucide-react';
import './SignInButton.css';

export default function SignInButton({ user, onSignInClick, onSignOutClick }) {
  if (user) {
    return (
      <button type="button" className="glass-button signin-button" onClick={onSignOutClick}>
        <LogOut size={13} strokeWidth={2} />
        <span className="signin-btn-label">Sign out</span>
      </button>
    );
  }
  return (
    <button type="button" className="glass-button signin-button" onClick={onSignInClick}>
      <Lock size={13} strokeWidth={2} />
      <span className="signin-btn-label">Admin sign in</span>
    </button>
  );
}

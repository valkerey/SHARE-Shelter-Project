import { Lock } from 'lucide-react';
import './SignInButton.css';

export default function SignInButton({ user, onSignInClick, onSignOutClick }) {
  if (user) {
    return (
      <button type="button" className="glass-button signin-button" onClick={onSignOutClick}>
        Sign out
      </button>
    );
  }
  return (
    <button type="button" className="glass-button signin-button" onClick={onSignInClick}>
      <Lock size={13} strokeWidth={2} style={{ marginRight: 5, verticalAlign: 'middle' }} />
      Admin sign in
    </button>
  );
}

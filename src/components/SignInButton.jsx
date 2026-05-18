import './SignInButton.css';

export default function SignInButton({ user, onSignInClick, onSignOutClick }) {
  if (user) {
    return (
      <div className="glass-button signin-badge">
        <span className="signin-badge-email">✓ {user.email}</span>
        <button type="button" className="signin-badge-logout" onClick={onSignOutClick}>
          Sign out
        </button>
      </div>
    );
  }
  return (
    <button type="button" className="glass-button signin-button" onClick={onSignInClick}>
      🔒 Admin sign in
    </button>
  );
}

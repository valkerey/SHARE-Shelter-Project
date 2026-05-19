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
      🔒 Admin sign in
    </button>
  );
}

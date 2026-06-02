import { Lock, LogOut } from 'lucide-react';
import './TopBar.css';

export default function TopBar({ user, onSignInClick, onSignOutClick }) {
  return (
    <div className="topbar">
      <span className="topbar-title">SHARE Host Site Tool</span>
      <div className="topbar-actions">
        {user ? (
          <button type="button" className="topbar-btn" onClick={onSignOutClick}>
            <LogOut size={13} strokeWidth={2} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Sign out
          </button>
        ) : (
          <button type="button" className="topbar-btn" onClick={onSignInClick}>
            <Lock size={13} strokeWidth={2} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Admin sign in
          </button>
        )}
      </div>
    </div>
  );
}

import { useAuth } from '../context/AuthContext';

export default function IconRail() {
  const { username, logout } = useAuth();

  const initials = username
    ? username.slice(0, 2).toUpperCase()
    : '??';

  return (
    <div className="icon-rail">
      {/* App logo */}
      <div className="icon-rail-logo" title="ChitChat">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      </div>

      <div className="icon-rail-divider" />

      <div className="icon-rail-spacer" />

      {/* Avatar / Logout */}
      <div
        className="icon-rail-avatar"
        title={`Logged in as ${username} - click to logout`}
        onClick={logout}
      >
        {initials}
      </div>
    </div>
  );
}

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
        CC
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

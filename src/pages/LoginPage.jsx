import { useState } from 'react';
import { login as apiLogin } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ onSwitchToSignup }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginWithTokens } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    try {
      const data = await apiLogin(username.trim(), password);
      loginWithTokens(data.accessToken, data.refreshToken);
    } catch (err) {
      setError('Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">CC</div>
          <span className="auth-logo-text">ChitChat</span>
        </div>

        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to continue your conversations</p>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label" htmlFor="login-username">Username</label>
            <input
              id="login-username"
              className="form-input"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="form-input"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
            {!loading && <span>→</span>}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToSignup(); }}>
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}

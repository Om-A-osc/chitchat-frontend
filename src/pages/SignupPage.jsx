import { useState } from 'react';
import { signup as apiSignup } from '../services/api';

export default function SignupPage({ onSwitchToLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tagline, setTagline] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    setLoading(true);
    try {
      await apiSignup(
        username.trim(),
        password,
        tagline.trim() || null,
        profilePicture.trim() || null
      );
      setSuccess('Account created! Redirecting to login...');
      setTimeout(() => onSwitchToLogin(), 1500);
    } catch (err) {
      console.error('Signup error:', err);
      setError('Signup failed. Username may already be taken.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </div>
          <span className="auth-logo-text">ChitChat</span>
        </div>

        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Join the conversation in seconds</p>

        {error && <div className="auth-error">{error}</div>}
        {success && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'rgba(0, 200, 83, 0.1)',
              border: '1px solid rgba(0, 200, 83, 0.2)',
              borderRadius: 'var(--radius-md)',
              color: '#00C853',
              fontSize: 'var(--font-size-sm)',
              animation: 'fadeInDown 0.3s ease',
            }}
          >
            {success}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label" htmlFor="signup-username">Username</label>
            <input
              id="signup-username"
              className="form-input"
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              className="form-input"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="signup-tagline">Tagline (optional)</label>
            <input
              id="signup-tagline"
              className="form-input"
              type="text"
              placeholder="What's your vibe?"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="signup-picture">Profile Picture URL (optional)</label>
            <input
              id="signup-picture"
              className="form-input"
              type="url"
              placeholder="https://example.com/avatar.jpg"
              value={profilePicture}
              onChange={(e) => setProfilePicture(e.target.value)}
            />
          </div>

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
            {!loading && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            )}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); onSwitchToLogin(); }}>
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

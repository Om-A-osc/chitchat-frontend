import { useState } from 'react';
import { signup as apiSignup } from '../services/api';
import { getOrCreateUserKeyPair } from '../services/e2ee';

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
      const trimmedUser = username.trim();
      const keys = await getOrCreateUserKeyPair(trimmedUser);
      await apiSignup(
        trimmedUser,
        password,
        tagline.trim() || null,
        profilePicture.trim() || null,
        keys?.publicKeyBase64 || null
      );
      setSuccess('Account created! Redirecting to login...');
      setTimeout(() => onSwitchToLogin(), 1500);
    } catch (err) {
      setError('Signup failed. Username may already be taken.');
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
            {!loading && <span>→</span>}
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

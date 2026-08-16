import { useState } from 'react';

export default function JoinRoomModal({ onClose, onSubmit }) {
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const trimmedId = roomId.trim();
    if (!trimmedId) {
      setError('Room ID is required.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit(trimmedId);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to join room.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Join a Room</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="auth-error">{error}</div>}

            <div className="form-field">
              <label className="form-label" htmlFor="join-room-id">Room ID</label>
              <input
                id="join-room-id"
                className="form-input"
                type="text"
                placeholder="Paste the Room ID here"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}
              style={{ width: 'auto', padding: '8px 20px', marginTop: 0 }}
            >
              {loading ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState } from 'react';

export default function RoomInfoModal({ room, onClose, onLeave }) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!room) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(room.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  }

  async function handleLeave() {
    if (!window.confirm(`Are you sure you want to leave #${room.roomname}?`)) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      await onLeave(room.roomId);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to leave room.');
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Room Info: #{room.roomname}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="auth-error">{error}</div>}

          <div style={{ marginBottom: '24px' }}>
            <label className="form-label">Room ID (Share this to invite friends)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="form-input"
                type="text"
                readOnly
                value={room.roomId}
                style={{ flex: 1, backgroundColor: 'var(--color-bg-secondary)' }}
              />
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={handleCopy}
                style={{ padding: '8px 16px', minWidth: '80px' }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div>
            <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>
              Participants ({room.members?.length || 0})
            </label>
            <div style={{ 
              maxHeight: '200px', 
              overflowY: 'auto',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)'
            }}>
              {room.members?.map((member, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderBottom: idx < room.members.length - 1 ? '1px solid var(--color-border)' : 'none'
                  }}
                >
                  <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>
                    {member.username}
                  </span>
                  <span style={{ 
                    fontSize: 'var(--font-size-xs)', 
                    backgroundColor: 'var(--color-bg-tertiary)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    color: 'var(--color-text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {member.role || 'Member'}
                  </span>
                </div>
              ))}
              {(!room.members || room.members.length === 0) && (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  No participants found.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={handleLeave}
            disabled={loading}
            style={{ 
              color: 'var(--color-error, #ef4444)',
              borderColor: 'var(--color-error, #ef4444)',
            }}
          >
            {loading ? 'Leaving...' : 'Leave Room'}
          </button>
          
          <button type="button" className="btn-primary" onClick={onClose} style={{ width: 'auto', padding: '8px 20px' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

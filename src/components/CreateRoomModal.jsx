import { useState } from 'react';

export default function CreateRoomModal({ onClose, onSubmit }) {
  const [roomname, setRoomname] = useState('');
  const [participants, setParticipants] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('50');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!roomname.trim()) {
      setError('Room name is required.');
      return;
    }

    const participantSet = participants
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    setLoading(true);
    try {
      await onSubmit({
        roomname: roomname.trim(),
        participants: participantSet,
        maximumCapacity: parseInt(maxCapacity, 10) || 50,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create room.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Create a new room</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="auth-error">{error}</div>}

            <div className="form-field">
              <label className="form-label" htmlFor="room-name">Room Name</label>
              <input
                id="room-name"
                className="form-input"
                type="text"
                placeholder="e.g. q3-marketing-campaign"
                value={roomname}
                onChange={(e) => setRoomname(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="room-participants">
                Participants (comma-separated usernames)
              </label>
              <input
                id="room-participants"
                className="form-input"
                type="text"
                placeholder="e.g. alice, bob, charlie"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="room-capacity">Maximum Capacity</label>
              <input
                id="room-capacity"
                className="form-input"
                type="number"
                placeholder="50"
                min="2"
                max="1000"
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(e.target.value)}
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
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

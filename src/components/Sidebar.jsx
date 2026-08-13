export default function Sidebar({ rooms, activeRoomId, onSelectRoom, onCreateRoom, onJoinRoom, isOpen, onClose }) {
  return (
    <div className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">
            ChitChat
          </div>
        </div>


      </div>

      {/* Content */}
      <div className="sidebar-content">
        {/* Rooms section */}
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span className="sidebar-section-title">Rooms</span>
          </div>
          <div className="sidebar-room-actions">
            <button className="sidebar-room-action-btn" onClick={onJoinRoom}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Join Room
            </button>
            <button className="sidebar-room-action-btn create" onClick={onCreateRoom}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create Room
            </button>
          </div>

          {rooms.length === 0 && (
            <div
              style={{
                padding: '8px 16px',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-muted)',
                fontStyle: 'italic',
              }}
            >
              No rooms yet. Create one!
            </div>
          )}

          {rooms.map((room) => (
            <div
              key={room.roomId}
              className={`sidebar-item ${activeRoomId === room.roomId ? 'active' : ''}`}
              onClick={() => onSelectRoom(room)}
            >
              <span className="sidebar-item-icon">#</span>
              <span className="sidebar-item-text">{room.roomname}</span>
              {room.unread > 0 && (
                <span className="sidebar-item-badge">{room.unread}</span>
              )}
            </div>
          ))}
        </div>


      </div>
    </div>
  );
}

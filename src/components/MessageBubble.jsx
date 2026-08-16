import { useState } from 'react';

export default function MessageBubble({ message, isOwn, room }) {
  const [showStatus, setShowStatus] = useState(false);

  let time = '';
  if (message.createdTimestamp) {
    try {
      time = new Date(message.createdTimestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      time = '';
    }
  }
  const sender = message.sender || 'Unknown';
  const initials = sender.slice(0, 2).toUpperCase();

  const receipts = message.receipts || {};
  const hasReceipts = Object.keys(receipts).length > 0;
  
  // Helper to safely check if a receipt status is truthy (not null, false, or empty)
  const isStatusSet = (val) => {
    if (val === null || val === undefined || val === false || val === 'null' || val === '') return false;
    return true;
  };

  // Calculate overall status
  let overallStatus = 'sent'; // default
  if (hasReceipts) {
    const allRead = Object.keys(receipts).length > 0 && Object.values(receipts).every(r => isStatusSet(r.read));
    const anyDelivered = Object.values(receipts).some(r => isStatusSet(r.delivered) || isStatusSet(r.read));
    if (allRead) {
      overallStatus = 'read';
    } else if (anyDelivered) {
      overallStatus = 'delivered';
    }
  }

  // Determine if we should allow clicking for info
  const members = room?.members || [];
  const otherMembers = members.filter(m => m.username !== sender).map(m => m.username);
  const canShowInfo = isOwn && otherMembers.length > 0;

  const isTampered = message.content?.startsWith('[TAMPERED');
  const isSignatureFailed = message.content?.startsWith('[SIGNATURE VERIFICATION FAILED');

  return (
    <div className={`message-group ${isOwn ? 'own' : ''}`}>
      <div className="message-avatar">{initials}</div>
      <div className="message-content" style={{ position: 'relative' }}>
        <div className="message-header">
          <span className={`message-sender ${isOwn ? 'is-you' : ''}`}>
            {isOwn ? 'You' : sender}
          </span>
          <span className="message-time">
            {time}
            {isOwn && (
              <span style={{ marginLeft: '4px', color: overallStatus === 'read' ? '#34B7F1' : 'var(--color-text-tertiary)', fontSize: '12px', fontWeight: 'bold' }}>
                {overallStatus === 'sent' ? '✓' : '✓✓'}
              </span>
            )}
          </span>
        </div>
        {isTampered || isSignatureFailed ? (
          <div className="message-security-alert" style={{
            color: '#FF4D4D',
            backgroundColor: 'rgba(255, 77, 77, 0.12)',
            border: '1px solid rgba(255, 77, 77, 0.35)',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '4px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>{message.content}</span>
          </div>
        ) : (
          <div 
            className="message-text" 
            onClick={() => { if (canShowInfo) setShowStatus(!showStatus); }}
            style={{ cursor: canShowInfo ? 'pointer' : 'default' }}
            title={canShowInfo ? "Click to view message info" : ""}
          >
            {message.content}
          </div>
        )}
        {showStatus && canShowInfo && (() => {
          const readBy = [];
          const deliveredTo = [];
          const notDeliveredTo = [];

          otherMembers.forEach((user) => {
            const status = receipts[user] || {};
            const isRead = isStatusSet(status.read);
            const isDeliv = isStatusSet(status.delivered) || isRead;
            
            if (isRead) readBy.push(user);
            else if (isDeliv) deliveredTo.push(user);
            else notDeliveredTo.push(user);
          });

          return (
            <div className="message-status-dropdown" style={{
              position: 'absolute',
              top: '100%',
              right: '0',
              marginTop: '4px',
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2)',
              zIndex: 100,
              boxShadow: 'var(--shadow-md)',
              minWidth: '180px'
            }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', fontWeight: 'bold', marginBottom: '4px', textAlign: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px' }}>MESSAGE INFO</div>
              
              {readBy.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '10px', color: '#34B7F1', fontWeight: 'bold', marginBottom: '4px' }}>Read by</div>
                  {readBy.map((user) => (
                    <div key={user} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', fontSize: '12px' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>{user}</span>
                      <span style={{ color: '#34B7F1', fontWeight: 'bold' }} title="Read">✓✓</span>
                    </div>
                  ))}
                </div>
              )}

              {readBy.length > 0 && (deliveredTo.length > 0 || notDeliveredTo.length > 0) && (
                <div style={{ borderBottom: '1px solid var(--color-border)', margin: '4px 0 8px 0' }}></div>
              )}

              {deliveredTo.length > 0 && (
                <div style={{ marginBottom: notDeliveredTo.length > 0 ? '8px' : '0' }}>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontWeight: 'bold', marginBottom: '4px' }}>Delivered to</div>
                  {deliveredTo.map((user) => (
                    <div key={user} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', fontSize: '12px' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>{user}</span>
                      <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 'bold' }} title="Delivered">✓✓</span>
                    </div>
                  ))}
                </div>
              )}

              {deliveredTo.length > 0 && notDeliveredTo.length > 0 && (
                <div style={{ borderBottom: '1px solid var(--color-border)', margin: '4px 0 8px 0' }}></div>
              )}

              {notDeliveredTo.length > 0 && (
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontWeight: 'bold', marginBottom: '4px' }}>Remaining</div>
                  {notDeliveredTo.map((user) => (
                    <div key={user} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0', fontSize: '12px' }}>
                      <span style={{ color: 'var(--color-text-secondary)' }}>{user}</span>
                      <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 'bold' }} title="Sent">✓</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

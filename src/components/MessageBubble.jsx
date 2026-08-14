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
  
  const isStatusSet = (val) => {
    if (val === null || val === undefined || val === false || val === 'null' || val === '') return false;
    return true;
  };

  let overallStatus = 'sent';
  if (hasReceipts) {
    const allRead = Object.values(receipts).some(r => isStatusSet(r.read));
    const anyDelivered = Object.values(receipts).some(r => isStatusSet(r.delivered) || isStatusSet(r.read));
    if (allRead) {
      overallStatus = 'read';
    } else if (anyDelivered) {
      overallStatus = 'delivered';
    }
  }

  const members = room?.members || [];
  const otherMembers = members.filter(m => m.username !== sender).map(m => m.username);
  const canShowInfo = isOwn && otherMembers.length > 0;

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
        <div 
          className="message-text" 
          onClick={() => { if (canShowInfo) setShowStatus(!showStatus); }}
          style={{ cursor: canShowInfo ? 'pointer' : 'default' }}
          title={canShowInfo ? "Click to view message info" : ""}
        >
          {message.content}
        </div>
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

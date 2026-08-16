import { useRef, useEffect, useLayoutEffect } from 'react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';

export default function ChatArea({ 
  room, 
  messages, 
  username, 
  onSendMessage, 
  connectionStatus,
  historyStatus,
  onLoadMore,
  onShowRoomInfo,
  onToggleSidebar
}) {
  const messagesEndRef = useRef(null);
  const chatMessagesRef = useRef(null);
  
  const prevScrollHeightRef = useRef(0);
  const prevMessagesLengthRef = useRef(0);
  const isScrolledToBottomRef = useRef(true);
  const lastRoomIdRef = useRef(room?.roomId);

  // Handle scroll events
  function handleScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    
    // Check if scrolled to top
    if (scrollTop === 0 && historyStatus === 'unfetched') {
      onLoadMore(room?.roomId);
    }
    
    // Check if scrolled to bottom (allow 50px threshold)
    isScrolledToBottomRef.current = scrollHeight - scrollTop - clientHeight < 50;
  }

  // Preserve scroll position when history is prepended, or auto-scroll to bottom for new messages
  useLayoutEffect(() => {
    const scrollContainer = chatMessagesRef.current;
    if (!scrollContainer) return;

    const isNewRoom = room?.roomId !== lastRoomIdRef.current;
    
    if (isNewRoom) {
      // Switched rooms: reset scroll state to bottom
      lastRoomIdRef.current = room?.roomId;
      isScrolledToBottomRef.current = true;
      messagesEndRef.current?.scrollIntoView();
      prevScrollHeightRef.current = scrollContainer.scrollHeight;
      prevMessagesLengthRef.current = messages.length;
      return;
    }

    const messagesAdded = messages.length > prevMessagesLengthRef.current;
    const isPrepended = messagesAdded && scrollContainer.scrollTop === 0 && historyStatus === 'fetched';

    if (isPrepended) {
      // Messages were prepended (history loaded): adjust scroll to stay at the same message
      const newScrollHeight = scrollContainer.scrollHeight;
      const heightDifference = newScrollHeight - prevScrollHeightRef.current;
      scrollContainer.scrollTop = heightDifference;
    } else if (messagesAdded && isScrolledToBottomRef.current) {
      // New real-time message added and user was at bottom: scroll down
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    // Update refs for next render
    prevScrollHeightRef.current = scrollContainer.scrollHeight;
    prevMessagesLengthRef.current = messages.length;
  }, [messages, room?.roomId, historyStatus]);

  // Initial trigger for history fetch when room is opened
  useEffect(() => {
    if (room && historyStatus === 'unfetched') {
      onLoadMore(room.roomId);
    }
  }, [room?.roomId, historyStatus, onLoadMore]);

  // No room selected
  if (!room) {
    return (
      <div className="chat-area" style={{ position: 'relative' }}>
        <button 
          className="hamburger-btn" 
          onClick={onToggleSidebar} 
          title="Open sidebar"
          style={{ position: 'absolute', top: '24px', left: '24px', zIndex: 10 }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="no-room-selected">
          <div className="no-room-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h2 className="no-room-title">Welcome to ChitChat</h2>
          <p className="no-room-text">
            Select a room from the sidebar or create a new one to start chatting with your team.
          </p>
        </div>
      </div>
    );
  }

  // Group messages by date for dividers
  function getDateLabel(timestamp) {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'TODAY';
    if (date.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).toUpperCase();
  }

  let lastDateLabel = null;

  return (
    <div className="chat-area">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-left">
          <button className="hamburger-btn" onClick={onToggleSidebar} title="Open sidebar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 className="chat-header-title">
            <span className="chat-header-hash">#</span>
            {room.roomname}
          </h1>
          <span className="chat-header-description">
            Room chat • {messages.length} messages
          </span>
        </div>
        <div className="chat-header-right">

          <button className="chat-header-btn" title="More options" onClick={onShowRoomInfo}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Connection status */}
      {connectionStatus && connectionStatus !== 'connected' && (
        <div className={`connection-status ${connectionStatus}`}>
          <span className="connection-dot" />
          {connectionStatus === 'connecting' && 'Connecting to chat server...'}
          {connectionStatus === 'disconnected' && 'Disconnected. Trying to reconnect...'}
        </div>
      )}

      {/* Messages */}
      <div 
        className="chat-messages" 
        ref={chatMessagesRef}
        onScroll={handleScroll}
      >
        {historyStatus === 'loading' && (
          <div className="chat-history-status">
            <span className="connection-dot" /> Loading history...
          </div>
        )}
        {historyStatus === 'error' && (
          <div className="chat-history-status error" style={{ color: 'red', textAlign: 'center', padding: '10px' }}>
            Failed to load history. <button onClick={() => onLoadMore(room?.roomId)} style={{marginLeft: '10px', padding: '2px 8px'}}>Retry</button>
          </div>
        )}
        {historyStatus === 'fetched' && messages.length > 0 && (
          <div className="chat-history-status end">
            End of chat history
          </div>
        )}
        
        {messages.length === 0 && historyStatus === 'fetched' ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 className="chat-empty-title">Start the conversation</h3>
            <p className="chat-empty-text">
              This is the beginning of <strong>#{room.roomname}</strong>. Send a message to get things going!
            </p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const dateLabel = getDateLabel(msg.createdTimestamp);
            let showDivider = false;
            if (dateLabel && dateLabel !== lastDateLabel) {
              showDivider = true;
              lastDateLabel = dateLabel;
            }

            return (
              <div key={msg.messageId || `msg-${i}`}>
                {showDivider && (
                  <div className="chat-date-divider">
                    <span className="chat-date-divider-text">{dateLabel}</span>
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  isOwn={msg.sender === username}
                  room={room}
                />
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput
        roomName={room.roomname}
        onSend={onSendMessage}
        disabled={connectionStatus !== 'connected'}
      />
    </div>
  );
}

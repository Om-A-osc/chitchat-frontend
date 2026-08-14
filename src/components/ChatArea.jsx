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

  function handleScroll(e) {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    
    if (scrollTop === 0 && historyStatus === 'unfetched') {
      onLoadMore(room?.roomId);
    }
    
    isScrolledToBottomRef.current = scrollHeight - scrollTop - clientHeight < 50;
  }

  useLayoutEffect(() => {
    const scrollContainer = chatMessagesRef.current;
    if (!scrollContainer) return;

    const isNewRoom = room?.roomId !== lastRoomIdRef.current;
    
    if (isNewRoom) {
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
      const newScrollHeight = scrollContainer.scrollHeight;
      const heightDifference = newScrollHeight - prevScrollHeightRef.current;
      scrollContainer.scrollTop = heightDifference;
    } else if (messagesAdded && isScrolledToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    prevScrollHeightRef.current = scrollContainer.scrollHeight;
    prevMessagesLengthRef.current = messages.length;
  }, [messages, room?.roomId, historyStatus]);

  useEffect(() => {
    if (room && historyStatus === 'unfetched') {
      onLoadMore(room.roomId);
    }
  }, [room?.roomId, historyStatus, onLoadMore]);

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
          <h2 className="no-room-title">Welcome to ChitChat</h2>
          <p className="no-room-text">
            Select a room from the sidebar or create a new one to start chatting with your team.
          </p>
        </div>
      </div>
    );
  }

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

      {connectionStatus && connectionStatus !== 'connected' && (
        <div className={`connection-status ${connectionStatus}`}>
          <span className="connection-dot" />
          {connectionStatus === 'connecting' && 'Connecting to chat server...'}
          {connectionStatus === 'disconnected' && 'Disconnected. Trying to reconnect...'}
        </div>
      )}

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
            Failed to load history. <button onClick={onLoadMore} style={{marginLeft: '10px', padding: '2px 8px'}}>Retry</button>
          </div>
        )}
        {historyStatus === 'fetched' && messages.length > 0 && (
          <div className="chat-history-status end">
            End of chat history (last 2 days)
          </div>
        )}
        
        {messages.length === 0 && historyStatus === 'fetched' ? (
          <div className="chat-empty">
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

      <MessageInput
        roomName={room.roomname}
        onSend={onSendMessage}
        disabled={connectionStatus !== 'connected'}
      />
    </div>
  );
}

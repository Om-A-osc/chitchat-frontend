import { useState, useRef, useEffect } from 'react';

export default function MessageInput({ roomName, onSend, disabled }) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [message]);

  function handleSend() {
    const trimmed = message.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setMessage('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="message-input-container">
      <div className="message-input-wrapper">
        <textarea
          ref={textareaRef}
          className="message-input-field"
          placeholder={`Message #${roomName || 'general'}...`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />
        <div className="message-input-toolbar">


          <button
            className="message-send-btn"
            onClick={handleSend}
            disabled={!message.trim() || disabled}
            type="button"
          >
            SEND
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

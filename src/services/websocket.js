const WS_BASE = 'ws://localhost:8080/ws';

export function connectWebSocket(token, onMessage, onOpen, onClose, onError) {
  const url = `${WS_BASE}?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('[WS] Connected');
    if (onOpen) onOpen();
  };

  ws.onmessage = (event) => {
    try {
      let data = JSON.parse(event.data);
      if (data && Array.isArray(data.createdTimestamp)) {
        const [year, month, day, hour = 0, minute = 0, second = 0, ns = 0] = data.createdTimestamp;
        data.createdTimestamp = new Date(year, month - 1, day, hour, minute, second, Math.floor(ns / 1000000)).getTime();
      }
      if (onMessage) onMessage(data);
    } catch (e) {
      console.error('[WS] Failed to parse message:', e);
    }
  };

  ws.onclose = (event) => {
    console.log('[WS] Disconnected', event.code, event.reason);
    if (onClose) onClose(event);
  };

  ws.onerror = (error) => {
    console.error('[WS] Error:', error);
    if (onError) onError(error);
  };

  return {
    send(msg) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    },

    joinRoom(roomId) {
      this.send({ type: 'JOIN_ROOM', roomId });
    },

    sendMessage(roomId, content) {
      this.send({ type: 'SEND_MESSAGE', roomId, content });
    },

    sendDeliveredReceipt(roomId, messageId) {
      this.send({ type: 'MESSAGE_DELIVERED', roomId, messageId, messageDelivered: true });
    },

    sendReadReceipt(roomId, messageId) {
      this.send({ type: 'MESSAGE_READ', roomId, messageId, messageRead: true });
    },

    close() {
      ws.close();
    },

    requestRoomKey(roomId) {
      this.send({ type: 'REQUEST_ROOM_KEY', roomId });
    },

    sendKeyExchange(roomId, recipientUsername, encryptedKey) {
      this.send({ type: 'KEY_EXCHANGE', roomId, recipientUsername, encryptedKey });
    },

    ackKeyExchange(roomId) {
      this.send({ type: 'ACK_KEY_EXCHANGE', roomId });
    },

    get readyState() {
      return ws.readyState;
    },
  };
}

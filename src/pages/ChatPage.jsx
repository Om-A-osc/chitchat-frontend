import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { createRoom, fetchRooms, fetchRecentMessages, fetchMessageReceipt, fetchWithAuth, API_BASE } from '../services/api';
import { connectWebSocket } from '../services/websocket';
import { initUserE2EE, getOrLoadRoomKey, createEncryptedRoomKeys, encryptMessage, decryptMessage, cacheRoomKey, fetchUserPublicKey, getOrCreateUserKeyPair, bufferToBase64, base64ToBuffer } from '../services/e2ee';
import IconRail from '../components/IconRail';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import CreateRoomModal from '../components/CreateRoomModal';
import JoinRoomModal from '../components/JoinRoomModal';
import RoomInfoModal from '../components/RoomInfoModal';
import { joinRoom, leaveRoom } from '../services/api';

export default function ChatPage() {
  const { token, username } = useAuth();

  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages] = useState({});
  const [historyStatus, setHistoryStatus] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showRoomInfoModal, setShowRoomInfoModal] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const wsRef = useRef(null);
  const activeRoomRef = useRef(null);
  const roomsRef = useRef([]);
  const roomKeysRef = useRef(new Map());
  const readReceiptsSentRef = useRef(new Set());

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    if (token && username) {
      initUserE2EE(username, fetchWithAuth, API_BASE);
    }
  }, [token, username]);

  const getRoomAesKey = useCallback(async (roomId, forceRefresh = false) => {
    if (!roomId) return null;
    if (!forceRefresh && roomKeysRef.current.has(roomId)) {
      const keys = roomKeysRef.current.get(roomId);
      if (keys && keys.length > 0) return keys;
    }

    const currentRooms = roomsRef.current;
    const roomObj = currentRooms.find(r => r.roomId === roomId);
    const participants = roomObj?.members ? roomObj.members.map(m => m.username) : [];

    const keys = await getOrLoadRoomKey(roomId, username, participants, fetchWithAuth, API_BASE, forceRefresh);
    if (keys && keys.length > 0) {
      roomKeysRef.current.set(roomId, keys);
      return keys;
    } else {
      // Key not present in cache, request it over WS
      if (wsRef.current) {
        wsRef.current.requestRoomKey(roomId);
      }
      return [];
    }
  }, [username]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function loadRooms() {
      try {
        const fetchedRooms = await fetchRooms(token);
        if (!cancelled) setRooms(fetchedRooms);
      } catch (err) {
        console.error(err);
      }
    }

    loadRooms();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (!token) return;

    let isCancelled = false;
    let reconnectTimer = null;

    function connect() {
      if (isCancelled) return;

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      setConnectionStatus('connecting');

      const ws = connectWebSocket(
        token,
        async (data) => {
          if (isCancelled) return;

          if (data.type === 'MESSAGE_STATUS_UPDATE') {
            setMessages((prev) => {
              const newMessages = { ...prev };
              let found = false;
              for (const rId of Object.keys(newMessages)) {
                const roomMsgs = [...newMessages[rId]];
                const idx = roomMsgs.findIndex(m => m.messageId === data.messageId);
                if (idx !== -1) {
                  const msg = { ...roomMsgs[idx] };
                  if (!msg.receipts) msg.receipts = {};
                  msg.receipts = {
                    ...msg.receipts,
                    [data.username]: {
                      delivered: data.messageDelivered,
                      read: data.messageRead,
                    }
                  };
                  roomMsgs[idx] = msg;
                  newMessages[rId] = roomMsgs;
                  found = true;
                  break;
                }
              }
              return found ? newMessages : prev;
            });
            return;
          }

          if (data.type === 'CHAT_MESSAGE') {
            const roomId = data.roomId;
            if (!roomId) return;
            
            const currentRoom = activeRoomRef.current;

            let aesKey = await getRoomAesKey(roomId);
            let decryptedContent = await decryptMessage(data.content, aesKey);
            
            if (decryptedContent === '[Decryption Failed]') {
              aesKey = await getRoomAesKey(roomId, true);
              decryptedContent = await decryptMessage(data.content, aesKey);
            }
            
            const decryptedData = { ...data, content: decryptedContent };

            setMessages((prev) => {
              const roomMsgs = prev[roomId] || [];
              if (roomMsgs.some(m => m.messageId === data.messageId)) {
                return prev;
              }
              return {
                ...prev,
                [roomId]: [...roomMsgs, decryptedData],
              };
            });

            if (data.sender !== username && wsRef.current) {
              wsRef.current.sendDeliveredReceipt(roomId, data.messageId);
              
              if (currentRoom && currentRoom.roomId === roomId) {
                wsRef.current.sendReadReceipt(roomId, data.messageId);
                readReceiptsSentRef.current.add(data.messageId);
              }
            }
            return;
          }

          if (data.type === 'REQUEST_ROOM_KEY') {
            const roomId = data.roomId;
            const requester = data.sender;
            
            if (requester !== username && roomKeysRef.current.has(roomId)) {
              const keys = roomKeysRef.current.get(roomId);
              if (keys && keys.length > 0) {
                try {
                  const activeKey = keys[keys.length - 1];
                  const pubKey = await fetchUserPublicKey(requester, fetchWithAuth, API_BASE);
                  if (pubKey) {
                    const exportedRawAes = await window.crypto.subtle.exportKey('raw', activeKey);
                    const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
                      { name: 'RSA-OAEP' },
                      pubKey,
                      exportedRawAes
                    );
                    const encryptedKeyBase64 = bufferToBase64(encryptedKeyBuffer);
                    if (wsRef.current) {
                      wsRef.current.sendKeyExchange(roomId, requester, encryptedKeyBase64);
                    }
                  }
                } catch (e) {
                  console.error('Failed to send key exchange', e);
                }
              }
            }
            return;
          }

          if (data.type === 'KEY_EXCHANGE') {
            if (data.recipientUsername === username) {
              const roomId = data.roomId;
              try {
                const myKeys = await getOrCreateUserKeyPair(username);
                if (myKeys) {
                  const decryptedRaw = await window.crypto.subtle.decrypt(
                    { name: 'RSA-OAEP' },
                    myKeys.privateKey,
                    base64ToBuffer(data.encryptedKey)
                  );
                  const aesKey = await window.crypto.subtle.importKey(
                    'raw',
                    decryptedRaw,
                    { name: 'AES-GCM' },
                    false,
                    ['encrypt', 'decrypt']
                  );
                  await cacheRoomKey(roomId, aesKey);
                  
                  const existingKeys = roomKeysRef.current.get(roomId) || [];
                  roomKeysRef.current.set(roomId, [...existingKeys, aesKey]);
                  
                  if (wsRef.current) {
                    wsRef.current.ackKeyExchange(roomId);
                  }
                  
                  // Trigger reload history to decrypt messages with the new key
                  if (activeRoomRef.current && activeRoomRef.current.roomId === roomId) {
                    handleLoadHistory(roomId);
                  }
                }
              } catch (e) {
                console.error('Failed to decrypt key exchange', e);
              }
            }
            return;
          }
        },
        () => {
          if (isCancelled) return;
          setConnectionStatus('connected');
          const currentRoom = activeRoomRef.current;
          if (currentRoom) {
            ws.joinRoom(currentRoom.roomId);
          }
        },
        () => {
          if (isCancelled) return;
          setConnectionStatus('disconnected');
          reconnectTimer = setTimeout(() => {
            if (!isCancelled) connect();
          }, 5000);
        },
        () => {
          if (isCancelled) return;
          setConnectionStatus('disconnected');
        }
      );

      wsRef.current = ws;
    }

    connect();

    return () => {
      isCancelled = true;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token, username, getRoomAesKey]);

  useEffect(() => {
    if (!activeRoom || !wsRef.current || !username) return;
    
    const roomId = activeRoom.roomId;
    const roomMsgs = messages[roomId] || [];
    
    roomMsgs.forEach(async (msg) => {
      if (!readReceiptsSentRef.current.has(msg.messageId)) {
        readReceiptsSentRef.current.add(msg.messageId);
        
        const receiptsList = await fetchMessageReceipt(token, msg.messageId);
        
        if (Array.isArray(receiptsList)) {
          if (msg.sender !== username) {
            const myReceipt = receiptsList.find(r => r.messageId && r.messageId.username === username);
            if (!myReceipt || !myReceipt.messageRead) {
              if (wsRef.current) {
                wsRef.current.sendReadReceipt(roomId, msg.messageId);
              }
            }
          } else {
            if (receiptsList.length > 0) {
              setMessages(prev => {
                const newMsgs = { ...prev };
                const currentRoomMsgs = [...(newMsgs[roomId] || [])];
                const idx = currentRoomMsgs.findIndex(m => m.messageId === msg.messageId);
                
                if (idx !== -1) {
                  const newMsg = { ...currentRoomMsgs[idx] };
                  if (!newMsg.receipts) newMsg.receipts = {};
                  
                  receiptsList.forEach(r => {
                    if (r.messageId && r.messageId.username) {
                      newMsg.receipts[r.messageId.username] = {
                        delivered: r.messageDelivered,
                        read: r.messageRead
                      };
                    }
                  });
                  
                  currentRoomMsgs[idx] = newMsg;
                  newMsgs[roomId] = currentRoomMsgs;
                }
                return newMsgs;
              });
            }
          }
        }
      }
    });
  }, [activeRoom, messages, username, token]);

  const handleLoadHistory = useCallback(async (explicitRoomId) => {
    const roomId = explicitRoomId || activeRoomRef.current?.roomId;
    if (!roomId || !token) return;
    
    setHistoryStatus(prev => ({ ...prev, [roomId]: 'loading' }));
    
    try {
      const recentMessages = await fetchRecentMessages(token, roomId);
      let aesKey = await getRoomAesKey(roomId);
      let didRefresh = false;

      const decryptedHistory = [];
      for (const msg of recentMessages) {
        let dec = await decryptMessage(msg.content, aesKey);
        if (dec === '[Decryption Failed]' && !didRefresh) {
          aesKey = await getRoomAesKey(roomId, true);
          didRefresh = true;
          dec = await decryptMessage(msg.content, aesKey);
        }
        decryptedHistory.push({ ...msg, content: dec });
      }
      
      setMessages(prev => {
        const existing = prev[roomId] || [];
        const existingIds = new Set(existing.map(m => m.messageId));
        const newHistory = decryptedHistory.filter(m => !existingIds.has(m.messageId));
        
        return {
          ...prev,
          [roomId]: [...newHistory, ...existing]
        };
      });
      setHistoryStatus(prev => ({ ...prev, [roomId]: 'fetched' }));
    } catch {
      setHistoryStatus(prev => ({ ...prev, [roomId]: 'error' }));
    }
  }, [token, getRoomAesKey]);

  const handleSelectRoom = useCallback(async (room) => {
    setActiveRoom(room);
    getRoomAesKey(room.roomId);

    if (wsRef.current) {
      wsRef.current.joinRoom(room.roomId);
    }
    setIsSidebarOpen(false);
  }, [getRoomAesKey]);

  const handleSendMessage = useCallback(async (content) => {
    const room = activeRoomRef.current;
    if (!room || !wsRef.current) return;

    const aesKey = await getRoomAesKey(room.roomId);
    const encryptedPayload = await encryptMessage(content, aesKey);

    wsRef.current.sendMessage(room.roomId, encryptedPayload);
  }, [getRoomAesKey]);

  const handleCreateRoom = useCallback(async (data) => {
    const { roomAesKey, userKeys } = await createEncryptedRoomKeys(
      data.participants || [],
      username,
      fetchWithAuth,
      API_BASE
    );

    const roomIdResult = await createRoom(
      token,
      data.roomname,
      data.participants,
      data.maximumCapacity,
      userKeys
    );

    try {
      const updatedRooms = await fetchRooms(token);
      setRooms(updatedRooms);

      if (roomIdResult) {
        const parsedId = roomIdResult.trim();
        if (roomAesKey) {
          await cacheRoomKey(parsedId, roomAesKey);
          roomKeysRef.current.set(parsedId, [roomAesKey]);
        }
      }
    } catch {}
  }, [token, username]);

  const handleJoinRoom = useCallback(async (roomId) => {
    await joinRoom(roomId);
    
    try {
      const updatedRooms = await fetchRooms(token);
      setRooms(updatedRooms);
      
      const newRoom = updatedRooms.find(r => r.roomId === roomId);
      if (newRoom) handleSelectRoom(newRoom);
    } catch (err) {
      console.error('Failed to refresh rooms after join:', err);
    }
  }, [token, handleSelectRoom]);

  const handleLeaveRoom = useCallback(async (roomId) => {
    await leaveRoom(roomId);
    
    try {
      const updatedRooms = await fetchRooms(token);
      setRooms(updatedRooms);
      
      if (activeRoomRef.current?.roomId === roomId) {
        setActiveRoom(null);
      }
    } catch (err) {
      console.error('Failed to refresh rooms after leave:', err);
    }
  }, [token]);

  const handleOpenCreateModal = useCallback(() => setShowCreateModal(true), []);
  const handleCloseCreateModal = useCallback(() => setShowCreateModal(false), []);
  
  const handleOpenJoinModal = useCallback(() => setShowJoinModal(true), []);
  const handleCloseJoinModal = useCallback(() => setShowJoinModal(false), []);

  const handleOpenRoomInfoModal = useCallback(() => setShowRoomInfoModal(true), []);
  const handleCloseRoomInfoModal = useCallback(() => setShowRoomInfoModal(false), []);

  const currentMessages = activeRoom
    ? messages[activeRoom.roomId] || []
    : [];

  return (
    <div className="chat-layout">
      {isSidebarOpen && (
        <div 
          className="sidebar-overlay mobile-open" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}
      <IconRail />
      <Sidebar
        rooms={rooms}
        activeRoomId={activeRoom?.roomId}
        onSelectRoom={handleSelectRoom}
        onCreateRoom={handleOpenCreateModal}
        onJoinRoom={handleOpenJoinModal}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <ChatArea
        room={activeRoom}
        messages={currentMessages}
        username={username}
        onSendMessage={handleSendMessage}
        connectionStatus={connectionStatus}
        historyStatus={activeRoom ? (historyStatus[activeRoom.roomId] || 'unfetched') : 'unfetched'}
        onLoadMore={handleLoadHistory}
        onShowRoomInfo={handleOpenRoomInfoModal}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {showCreateModal && (
        <CreateRoomModal
          onClose={handleCloseCreateModal}
          onSubmit={handleCreateRoom}
        />
      )}

      {showJoinModal && (
        <JoinRoomModal
          onClose={handleCloseJoinModal}
          onSubmit={handleJoinRoom}
        />
      )}

      {showRoomInfoModal && activeRoom && (
        <RoomInfoModal
          room={activeRoom}
          onClose={handleCloseRoomInfoModal}
          onLeave={handleLeaveRoom}
        />
      )}
    </div>
  );
}

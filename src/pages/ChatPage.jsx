import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { createRoom, fetchRooms, fetchRecentMessages, fetchMessageReceipt } from '../services/api';
import { connectWebSocket } from '../services/websocket';
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
  const readReceiptsSentRef = useRef(new Set());

  // Keep active room ref in sync
  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  // Fetch rooms from backend on mount
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function loadRooms() {
      try {
        const fetchedRooms = await fetchRooms(token);
        if (!cancelled) setRooms(fetchedRooms);
      } catch (err) {
        console.error('Failed to fetch rooms:', err);
      }
    }

    loadRooms();
    return () => { cancelled = true; };
  }, [token]);

  // WebSocket connection - closure-scoped cancellation
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
        // onMessage
        (data) => {
          if (isCancelled) return;

          // Check if it's a MessageStatusUpdate
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
                  const currentReceipt = msg.receipts?.[data.username] || {};
                  msg.receipts = {
                    ...msg.receipts,
                    [data.username]: {
                      delivered: data.messageDelivered || currentReceipt.delivered,
                      read: data.messageRead || currentReceipt.read,
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

          // Check if it's a ChatMessageResponse
          if (data.type === 'CHAT_MESSAGE') {
            const roomId = data.roomId;
            if (!roomId) return;
            
            const currentRoom = activeRoomRef.current;

            setMessages((prev) => {
              const roomMsgs = prev[roomId] || [];
              if (roomMsgs.some(m => m.messageId === data.messageId)) {
                return prev; // already have it
              }
              return {
                ...prev,
                [roomId]: [...roomMsgs, data],
              };
            });

            // Send delivery and read receipts for others' messages
            if (data.sender !== username && data.sender !== 'SYSTEM_DAEMON' && wsRef.current) {
              wsRef.current.sendDeliveredReceipt(roomId, data.messageId);
              
              if (currentRoom && currentRoom.roomId === roomId) {
                wsRef.current.sendReadReceipt(roomId, data.messageId);
                readReceiptsSentRef.current.add(data.messageId);
              }
            }
          }
        },
        // onOpen
        () => {
          if (isCancelled) return;
          setConnectionStatus('connected');
          const currentRoom = activeRoomRef.current;
          if (currentRoom) {
            ws.joinRoom(currentRoom.roomId);
          }
        },
        // onClose
        () => {
          if (isCancelled) return;
          setConnectionStatus('disconnected');
          reconnectTimer = setTimeout(() => {
            if (!isCancelled) connect();
          }, 5000);
        },
        // onError
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
  }, [token, username]);

  // Mark existing messages as read when viewing a room, and fetch receipts for own messages
  useEffect(() => {
    if (!activeRoom || !wsRef.current || !username) return;
    
    const roomId = activeRoom.roomId;
    const roomMsgs = messages[roomId] || [];
    
    roomMsgs.forEach(async (msg) => {
      if (!readReceiptsSentRef.current.has(msg.messageId)) {
        // Mark as processed locally immediately so we don't spam duplicate API requests
        readReceiptsSentRef.current.add(msg.messageId);
        
        const receiptsList = await fetchMessageReceipt(token, msg.messageId);
        
        if (Array.isArray(receiptsList)) {
          if (msg.sender !== username) {
            // Check if WE have read it
            const myReceipt = receiptsList.find(r => r.messageId && r.messageId.username === username);
            
            // If we haven't read it yet (receipt is missing or messageRead is not set)
            if (!myReceipt || !myReceipt.messageRead) {
              if (wsRef.current) {
                wsRef.current.sendReadReceipt(roomId, msg.messageId);
              }
            }
          } else {
            // It's our own message! Populate the receipts so blue ticks persist after refresh
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

  // Load history for a room
  const handleLoadHistory = useCallback(async (explicitRoomId) => {
    // React child useEffects fire before parent useEffects, so activeRoomRef might be stale here.
    // By passing the roomId explicitly from the child, we avoid this race condition.
    const roomId = explicitRoomId || activeRoomRef.current?.roomId;
    if (!roomId || !token) return;
    
    console.log('[History] Starting history fetch for roomId:', roomId);
    
    setHistoryStatus(prev => ({ ...prev, [roomId]: 'loading' }));
    
    try {
      const recentMessages = await fetchRecentMessages(token, roomId);
      console.log('[History] Successfully fetched messages:', recentMessages);
      
      setMessages(prev => {
        const existing = prev[roomId] || [];
        // The recent messages might overlap with live WS messages we just received.
        // We filter out any recent messages that are already in the existing state.
        const existingIds = new Set(existing.map(m => m.messageId));
        const newHistory = recentMessages.filter(m => !existingIds.has(m.messageId));
        
        return {
          ...prev,
          [roomId]: [...newHistory, ...existing]
        };
      });
      setHistoryStatus(prev => ({ ...prev, [roomId]: 'fetched' }));
    } catch (err) {
      console.error('Failed to load history:', err);
      // Set status to error so it doesn't infinitely retry automatically
      setHistoryStatus(prev => ({ ...prev, [roomId]: 'error' }));
    }
  }, [token]);

  // Select a room
  const handleSelectRoom = useCallback((room) => {
    setActiveRoom(room);

    // Join new room
    if (wsRef.current) {
      wsRef.current.joinRoom(room.roomId);
    }
    // Close sidebar on mobile after selecting a room
    setIsSidebarOpen(false);
  }, []);

  // Send a message
  const handleSendMessage = useCallback((content) => {
    const room = activeRoomRef.current;
    if (!room || !wsRef.current) return;
    wsRef.current.sendMessage(room.roomId, content);
  }, []);

  // Create a room, then re-fetch rooms from backend
  const handleCreateRoom = useCallback(async (data) => {
    await createRoom(
      token,
      data.roomname,
      data.participants,
      data.maximumCapacity
    );

    try {
      const updatedRooms = await fetchRooms(token);
      setRooms(updatedRooms);
    } catch (err) {
      console.error('Failed to refresh rooms after create:', err);
    }
  }, [token]);

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

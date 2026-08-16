const API_BASE = `http://${window.location.hostname}:8080`;

async function fetchWithAuth(url, options = {}) {
  let token = localStorage.getItem('chitchat_token');
  let refreshToken = localStorage.getItem('chitchat_refresh');

  let res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (res.status === 401 && refreshToken) {
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      body: refreshToken
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      token = data.accessToken;
      refreshToken = data.refreshToken;

      localStorage.setItem('chitchat_token', token);
      localStorage.setItem('chitchat_refresh', refreshToken);

      window.dispatchEvent(new CustomEvent('auth_token_refreshed', {
        detail: { accessToken: token, refreshToken }
      }));

      // Retry original request
      res = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`
        }
      });
    } else {
      window.dispatchEvent(new Event('auth_session_expired'));
      throw new Error('Session expired');
    }
  } else if (res.status === 401) {
    window.dispatchEvent(new Event('auth_session_expired'));
  }

  return res;
}

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error('Login failed');
  }

  const data = await res.json();

  if (!data || !data.accessToken) {
    throw new Error('Invalid credentials');
  }

  return data;
}

export async function signup(username, password, tagline, profilePicture) {
  const res = await fetch(`${API_BASE}/user/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, tagline, profilePicture }),
  });

  if (!res.ok) {
    throw new Error('Signup failed');
  }

  return await res.json();
}

export async function createRoom(token, roomname, participants, maximumCapacity) {
  const res = await fetchWithAuth(`${API_BASE}/room/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ roomname, participants, maximumCapacity }),
  });

  if (!res.ok) {
    throw new Error('Failed to create room');
  }

  const text = await res.text();
  if (!text || text.trim() === '') {
    throw new Error('Failed to create room. Verify all participant usernames exist.');
  }
  return text;
}

export async function fetchRooms(token) {
  const res = await fetchWithAuth(`${API_BASE}/room/all`, {
    method: 'GET',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch rooms');
  }

  const data = await res.json();

  // The backend returns: { rooms: { "{roomId, roomname}": [{username, role}] } }
  // Java Map with record keys gets serialized with toString() keys by Jackson,
  // so we need to handle the response format.
  // The response shape is: { rooms: { "RoomIdRoomName[roomId=..., roomname=...]": [...] } }
  // OR if Jackson serializes records as objects: { rooms: [ { key: {roomId, roomname}, value: [...] } ] }
  // We'll handle both possible formats.

  const rooms = [];

  if (data.rooms) {
    // If rooms is an object (Map serialized as JSON object with string keys)
    if (typeof data.rooms === 'object' && !Array.isArray(data.rooms)) {
      for (const [key, members] of Object.entries(data.rooms)) {
        // Try to parse the key - it might be a JSON string or a Java toString()
        let roomId = null;
        let roomname = null;

        // Try JSON parse first (if Jackson uses @JsonKey or similar)
        try {
          const parsed = JSON.parse(key);
          roomId = parsed.roomId;
          roomname = parsed.roomname;
        } catch {
          // Java record toString format: "RoomIdRoomName[roomId=xxx, roomname=yyy]"
          const idMatch = key.match(/roomId=([^,\]]+)/);
          const nameMatch = key.match(/roomname=([^,\]]+)/);
          if (idMatch) roomId = idMatch[1].trim();
          if (nameMatch) roomname = nameMatch[1].trim();
        }

        if (roomId && roomname) {
          rooms.push({
            roomId,
            roomname,
            members: members || [],
            unread: 0,
          });
        }
      }
    }
    // If rooms is an array of entries
    else if (Array.isArray(data.rooms)) {
      for (const entry of data.rooms) {
        const roomInfo = entry.key || entry;
        const members = entry.value || [];
        rooms.push({
          roomId: roomInfo.roomId,
          roomname: roomInfo.roomname,
          members,
          unread: 0,
        });
      }
    }
  }

  return rooms;
}

export async function fetchRecentMessages(token, roomId) {
  console.log(`[API] fetchRecentMessages called for roomId: ${roomId}`);
  try {
    const res = await fetchWithAuth(`${API_BASE}/rooms/${roomId}/messages/recent`, {
      method: 'GET',
    });

    if (!res.ok) {
      console.error(`[API] fetchRecentMessages failed with status: ${res.status}`);
      throw new Error('Failed to fetch recent messages');
    }

    const data = await res.json();
    console.log(`[API] fetchRecentMessages raw data length: ${data?.length}`);


    // Transform backend MessageEntity array to frontend format
    // MessageEntity: { messageId, roomId, username, content, createdTimestamp, lastEditedTimestamp, isDeleted }
    return data.map(msg => {
      let ts = msg.createdTimestamp;

      // Spring Boot Jackson often serializes LocalDateTime to arrays: [year, month, day, hour, minute, second, ns]
      if (Array.isArray(ts)) {
        // Note: JavaScript Date expects 0-indexed months (0-11), so we subtract 1 from the month
        const [year, month, day, hour = 0, minute = 0, second = 0, ns = 0] = ts;
        ts = new Date(year, month - 1, day, hour, minute, second, Math.floor(ns / 1000000)).getTime();
      } else if (typeof ts === 'string') {
        ts = new Date(ts).getTime();
      }

      return {
        messageId: msg.messageId,
        content: msg.content,
        createdTimestamp: ts,
        sender: msg.username, // map username to sender for frontend
      };
    });
  } catch (error) {
    console.error('[API] Error in fetchRecentMessages:', error);
    throw error;
  }
}

export async function joinRoom(roomId) {
  const res = await fetchWithAuth(`${API_BASE}/room/join/${roomId}`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error('Failed to join room');
  }
  return await res.text();
}

export async function leaveRoom(roomId) {
  const res = await fetchWithAuth(`${API_BASE}/room/leave/${roomId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Failed to leave room');
  }
  return await res.text();
}

export async function fetchMessageReceipt(token, messageId) {
  try {
    const res = await fetchWithAuth(`${API_BASE}/rooms/${messageId}`, {
      method: 'GET',
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error('Failed to fetch message receipt');
    }
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error(`[API] Error fetching receipt for ${messageId}:`, error);
    return null;
  }
}


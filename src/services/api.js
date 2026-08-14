export const API_BASE = 'http://localhost:8080';

export async function fetchWithAuth(url, options = {}) {
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

export async function signup(username, password, tagline, profilePicture, publicKey) {
  const res = await fetch(`${API_BASE}/user/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, tagline, profilePicture, publicKey }),
  });

  if (!res.ok) {
    throw new Error('Signup failed');
  }

  return await res.json();
}

export async function createRoom(token, roomname, participants, maximumCapacity, userKeys) {
  const res = await fetchWithAuth(`${API_BASE}/room/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ roomname, participants, maximumCapacity, userKeys }),
  });

  if (!res.ok) {
    throw new Error('Failed to create room');
  }

  return await res.text();
}

export async function fetchRooms(token) {
  const res = await fetchWithAuth(`${API_BASE}/room/all`, {
    method: 'GET',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch rooms');
  }

  const data = await res.json();
  const rooms = [];

  if (data.rooms) {
    if (typeof data.rooms === 'object' && !Array.isArray(data.rooms)) {
      for (const [key, members] of Object.entries(data.rooms)) {
        let roomId = null;
        let roomname = null;

        try {
          const parsed = JSON.parse(key);
          roomId = parsed.roomId;
          roomname = parsed.roomname;
        } catch {
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
    } else if (Array.isArray(data.rooms)) {
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
  try {
    const res = await fetchWithAuth(`${API_BASE}/rooms/${roomId}/messages/recent`, {
      method: 'GET',
    });

    if (!res.ok) {
      throw new Error('Failed to fetch recent messages');
    }

    const data = await res.json();

    return data.map(msg => {
      let ts = msg.createdTimestamp;

      if (Array.isArray(ts)) {
        const [year, month, day, hour = 0, minute = 0, second = 0, ns = 0] = ts;
        ts = new Date(year, month - 1, day, hour, minute, second, Math.floor(ns / 1000000)).getTime();
      } else if (typeof ts === 'string') {
        ts = new Date(ts).getTime();
      }

      return {
        messageId: msg.messageId,
        content: msg.content,
        createdTimestamp: ts,
        sender: msg.username,
      };
    });
  } catch (error) {
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
    return null;
  }
}

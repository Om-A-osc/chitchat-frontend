const roomKeyCache = new Map();
const roomKeyB64Cache = new Map();
const userKeyCache = new Map();

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function getOrCreateUserKeyPair(username) {
  if (!username) return null;
  if (userKeyCache.has(username)) {
    return userKeyCache.get(username);
  }

  const privStorageKey = `chitchat_e2ee_priv_${username}`;
  const pubStorageKey = `chitchat_e2ee_pub_${username}`;

  const storedPriv = localStorage.getItem(privStorageKey);
  const storedPub = localStorage.getItem(pubStorageKey);

  if (storedPriv && storedPub) {
    try {
      const privateKey = await window.crypto.subtle.importKey(
        'pkcs8',
        base64ToBuffer(storedPriv),
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['decrypt']
      );

      const publicKey = await window.crypto.subtle.importKey(
        'spki',
        base64ToBuffer(storedPub),
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['encrypt']
      );

      const keyPairObj = { privateKey, publicKey, publicKeyBase64: storedPub };
      userKeyCache.set(username, keyPairObj);
      return keyPairObj;
    } catch {
      localStorage.removeItem(privStorageKey);
      localStorage.removeItem(pubStorageKey);
    }
  }

  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  const exportedPriv = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const exportedPub = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);

  const privBase64 = bufferToBase64(exportedPriv);
  const pubBase64 = bufferToBase64(exportedPub);

  localStorage.setItem(privStorageKey, privBase64);
  localStorage.setItem(pubStorageKey, pubBase64);

  const keyPairObj = { privateKey: keyPair.privateKey, publicKey: keyPair.publicKey, publicKeyBase64: pubBase64 };
  userKeyCache.set(username, keyPairObj);
  return keyPairObj;
}

export async function initUserE2EE(username, fetchWithAuth, apiBase) {
  try {
    const keyPair = await getOrCreateUserKeyPair(username);
    if (!keyPair) return;

    await fetchWithAuth(`${apiBase}/user/public-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicKey: keyPair.publicKeyBase64 }),
    });
  } catch {}
}

export async function fetchUserPublicKey(targetUsername, fetchWithAuth, apiBase) {
  try {
    const res = await fetchWithAuth(`${apiBase}/user/${targetUsername}/public-key`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.publicKey) return null;

    return await window.crypto.subtle.importKey(
      'spki',
      base64ToBuffer(data.publicKey),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      true,
      ['encrypt']
    );
  } catch {
    return null;
  }
}

export async function createEncryptedRoomKeys(participants, currentUsername, fetchWithAuth, apiBase) {
  const roomAesKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exportedRawAes = await window.crypto.subtle.exportKey('raw', roomAesKey);
  const allUsers = Array.from(new Set([...participants, currentUsername]));
  const userKeys = {};

  for (const user of allUsers) {
    try {
      let pubKey = null;
      if (user === currentUsername) {
        const myKeys = await getOrCreateUserKeyPair(currentUsername);
        pubKey = myKeys?.publicKey;
      } else {
        pubKey = await fetchUserPublicKey(user, fetchWithAuth, apiBase);
      }

      if (pubKey) {
        const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
          { name: 'RSA-OAEP' },
          pubKey,
          exportedRawAes
        );
        userKeys[user] = bufferToBase64(encryptedKeyBuffer);
      }
    } catch {}
  }

  return { roomAesKey, userKeys };
}

export async function getOrLoadRoomKey(roomId, currentUsername, participants = [], fetchWithAuth, apiBase, forceRefresh = false) {
  if (!roomId || !currentUsername) return [];

  let keys = roomKeyCache.get(roomId) || [];

  if (!forceRefresh && keys.length > 0) {
    return keys;
  }

  const myKeys = await getOrCreateUserKeyPair(currentUsername);
  if (!myKeys) return keys;

  const addKey = async (aesKey) => {
    const exported = await window.crypto.subtle.exportKey('raw', aesKey);
    const b64 = bufferToBase64(exported);
    if (!roomKeyB64Cache.has(roomId)) roomKeyB64Cache.set(roomId, new Set());
    const b64Set = roomKeyB64Cache.get(roomId);
    if (!b64Set.has(b64)) {
      b64Set.add(b64);
      keys.push(aesKey);
      roomKeyCache.set(roomId, keys);
    }
  };

  try {
    const res = await fetchWithAuth(`${apiBase}/room/${roomId}/key`);
    if (res.ok) {
      const data = await res.json();
      if (data.encryptedKey) {
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

        await addKey(aesKey);
        return keys;
      }
    }
  } catch {}

  if (keys.length > 0) {
    return keys;
  }

  try {
    const { roomAesKey, userKeys } = await createEncryptedRoomKeys(participants, currentUsername, fetchWithAuth, apiBase);
    if (Object.keys(userKeys).length > 0) {
      await fetchWithAuth(`${apiBase}/room/${roomId}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userKeys),
      });
    }
    await addKey(roomAesKey);
    return keys;
  } catch {
    return keys;
  }
}

export async function cacheRoomKey(roomId, aesKey) {
  if (!roomId || !aesKey) return;
  try {
    const exported = await window.crypto.subtle.exportKey('raw', aesKey);
    const b64 = bufferToBase64(exported);
    if (!roomKeyB64Cache.has(roomId)) roomKeyB64Cache.set(roomId, new Set());
    const b64Set = roomKeyB64Cache.get(roomId);
    let keys = roomKeyCache.get(roomId) || [];
    if (!b64Set.has(b64)) {
      b64Set.add(b64);
      keys.push(aesKey);
      roomKeyCache.set(roomId, keys);
    }
  } catch {}
}

export async function encryptMessage(text, aesKeys) {
  if (!text || !aesKeys) return text;
  const keyList = Array.isArray(aesKeys) ? aesKeys : [aesKeys];
  if (keyList.length === 0) return text;

  try {
    const activeKey = keyList[keyList.length - 1];
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(text);

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      activeKey,
      encodedText
    );

    const ivBase64 = bufferToBase64(iv);
    const cipherBase64 = bufferToBase64(ciphertextBuffer);

    return `E2EE:v1:${ivBase64}:${cipherBase64}`;
  } catch {
    return text;
  }
}

export async function decryptMessage(content, aesKeys) {
  if (!content || typeof content !== 'string') return content;
  if (!content.startsWith('E2EE:v1:')) return content;

  if (!aesKeys) {
    return '[Encrypted Message]';
  }
  const keyList = Array.isArray(aesKeys) ? aesKeys : [aesKeys];
  if (keyList.length === 0) {
    return '[Encrypted Message]';
  }

  try {
    const parts = content.split(':');
    if (parts.length < 4) return content;

    const ivBase64 = parts[2];
    const cipherBase64 = parts[3];

    const iv = base64ToBuffer(ivBase64);
    const ciphertext = base64ToBuffer(cipherBase64);

    for (let i = keyList.length - 1; i >= 0; i--) {
      try {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: new Uint8Array(iv) },
          keyList[i],
          ciphertext
        );
        return new TextDecoder().decode(decryptedBuffer);
      } catch {}
    }
    return '[Decryption Failed]';
  } catch {
    return '[Decryption Failed]';
  }
}

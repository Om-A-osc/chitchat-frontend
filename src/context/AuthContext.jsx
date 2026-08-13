import { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);

function parseJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('chitchat_token'));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('chitchat_refresh'));
  const [username, setUsername] = useState(() => {
    const t = localStorage.getItem('chitchat_token');
    if (t) {
      const payload = parseJwtPayload(t);
      return payload?.sub || payload?.username || null;
    }
    return null;
  });

  const loginWithTokens = useCallback((accessToken, refreshTkn) => {
    localStorage.setItem('chitchat_token', accessToken);
    localStorage.setItem('chitchat_refresh', refreshTkn);
    setToken(accessToken);
    setRefreshToken(refreshTkn);

    const payload = parseJwtPayload(accessToken);
    const user = payload?.sub || payload?.username || null;
    setUsername(user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('chitchat_token');
    localStorage.removeItem('chitchat_refresh');
    setToken(null);
    setRefreshToken(null);
    setUsername(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      refreshToken,
      username,
      isAuthenticated: !!token,
      loginWithTokens,
      logout,
    }),
    [token, refreshToken, username, loginWithTokens, logout]
  );

  useEffect(() => {
    const handleRefresh = (e) => {
      loginWithTokens(e.detail.accessToken, e.detail.refreshToken);
    };
    const handleExpire = () => {
      logout();
    };

    window.addEventListener('auth_token_refreshed', handleRefresh);
    window.addEventListener('auth_session_expired', handleExpire);

    return () => {
      window.removeEventListener('auth_token_refreshed', handleRefresh);
      window.removeEventListener('auth_session_expired', handleExpire);
    };
  }, [loginWithTokens, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

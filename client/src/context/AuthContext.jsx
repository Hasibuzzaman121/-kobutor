import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  generateIdentityKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPublicKey,
  importPrivateKey
} from '../crypto/e2ee';

const AuthContext = createContext(null);

// Safe response parser that prevents "Unexpected token < or A" when server returns HTML/text error
const parseJsonResponse = async (res, defaultErrMsg = 'Request failed') => {
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || defaultErrMsg);
      }
      return data;
    } catch (err) {
      if (err.message && err.message !== 'Unexpected token') throw err;
      throw new Error(defaultErrMsg);
    }
  } else {
    const text = await res.text();
    if (!res.ok) {
      // If server returned HTML (like 500 or 502 error page), extract clean error or use fallback
      if (text.includes('<html') || text.includes('<!DOCTYPE')) {
        throw new Error(`Server temporarily unavailable (${res.status}). Please try again.`);
      }
      throw new Error(text.trim() || defaultErrMsg);
    }
    return text;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [keyPair, setKeyPair] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize or load E2EE ECDH keys for the logged-in user
  const initCryptoKeys = async (currentUser, authToken) => {
    try {
      const privJwkStr = localStorage.getItem(`e2ee_priv_${currentUser.id}`);
      const pubJwkStr = localStorage.getItem(`e2ee_pub_${currentUser.id}`);

      let currentKeyPair = null;
      if (privJwkStr && pubJwkStr) {
        const privateKey = await importPrivateKey(privJwkStr);
        const publicKey = await importPublicKey(pubJwkStr);
        currentKeyPair = { privateKey, publicKey, pubJwkStr };
      } else {
        // Generate new ECDH identity key pair
        const generated = await generateIdentityKeyPair();
        const pubStr = await exportPublicKey(generated.publicKey);
        const privStr = await exportPrivateKey(generated.privateKey);

        localStorage.setItem(`e2ee_priv_${currentUser.id}`, privStr);
        localStorage.setItem(`e2ee_pub_${currentUser.id}`, pubStr);
        currentKeyPair = {
          privateKey: generated.privateKey,
          publicKey: generated.publicKey,
          pubJwkStr: pubStr
        };
      }

      setKeyPair(currentKeyPair);

      // If server does not have public key or differs, sync with backend
      if (!currentUser.publicKey || currentUser.publicKey !== currentKeyPair.pubJwkStr) {
        await fetch('/api/auth/public-key', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({ publicKey: currentKeyPair.pubJwkStr })
        });
      }
    } catch (err) {
      console.error('Failed to initialize E2EE keys:', err);
    }
  };

  // Verify token on initial boot
  useEffect(() => {
    const verifyUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          await initCryptoKeys(data.user, token);
        } else {
          logout();
        }
      } catch (err) {
        console.error('Auth verification error:', err);
        logout();
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, [token]);

  const login = async (username, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await parseJsonResponse(res, 'Failed to login');

    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    await initCryptoKeys(data.user, data.token);
    return data.user;
  };

  const register = async ({ username, displayName, password, avatar }) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, displayName, password, avatar })
    });
    const data = await parseJsonResponse(res, 'Failed to register');

    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    await initCryptoKeys(data.user, data.token);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setKeyPair(null);
  };

  const updateProfile = async (updates) => {
    const res = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });
    const data = await parseJsonResponse(res, 'Failed to update profile');
    setUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        keyPair,
        loading,
        login,
        register,
        logout,
        updateProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

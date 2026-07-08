import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { MatrixClient } from 'matrix-js-sdk';
import { initMatrixClient, getMatrixClient } from './client';

interface MatrixContextType {
  client: MatrixClient | null;
  isReady: boolean;
  login: (accessToken: string, userId: string, deviceId: string) => Promise<void>;
  logout: () => void;
}

const MatrixContext = createContext<MatrixContextType>({
  client: null,
  isReady: false,
  login: async () => {},
  logout: () => {},
});

export const MatrixProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [client, setClient] = useState<MatrixClient | null>(null);
  const [isReady, setIsReady] = useState(false);

  const logout = useCallback(() => {
    const c = getMatrixClient();
    if (c) c.stopClient();
    localStorage.removeItem('matrix_access_token');
    localStorage.removeItem('matrix_user_id');
    localStorage.removeItem('matrix_device_id');
    setClient(null);

    // CRITICAL: Clear Matrix Rust Crypto and sync IndexedDB without affecting Firebase Auth or other DBs
    if (window.indexedDB && window.indexedDB.databases) {
      window.indexedDB.databases().then(dbs => {
        dbs.forEach(db => {
          if (db.name && (db.name.startsWith('matrix-') || db.name.startsWith('qpi-'))) {
            window.indexedDB.deleteDatabase(db.name);
          }
        });
      }).catch(err => console.warn('Failed to clear IndexedDB:', err));
    } else {
      // Fallback for browsers that don't support databases()
      window.indexedDB.deleteDatabase('matrix-js-sdk::matrix-rust-sdk');
      window.indexedDB.deleteDatabase('qpi-chat-sync');
      window.indexedDB.deleteDatabase('qpi-matrix-store-v2');
    }
  }, []);

  useEffect(() => {
    // Try to auto-login if tokens exist
    const token = localStorage.getItem('matrix_access_token');
    const userId = localStorage.getItem('matrix_user_id');
    const deviceId = localStorage.getItem('matrix_device_id');

    if (token && userId && deviceId) {
      initMatrixClient(token, userId, deviceId).then((c) => {
        setClient(c);
        setIsReady(true);
      }).catch(err => {
        console.error("Failed to restore session", err);
        logout();
        setIsReady(true); // ready but not logged in
      });
    } else {
      setIsReady(true);
    }
  }, [logout]);

  const login = async (accessToken: string, userId: string, deviceId: string) => {
    localStorage.setItem('matrix_access_token', accessToken);
    localStorage.setItem('matrix_user_id', userId);
    localStorage.setItem('matrix_device_id', deviceId);
    
    setIsReady(false);
    const newClient = await initMatrixClient(accessToken, userId, deviceId);
    setClient(newClient);
    setIsReady(true);
  };

  return (
    <MatrixContext.Provider value={{ client, isReady, login, logout }}>
      {children}
    </MatrixContext.Provider>
  );
};

export const useMatrix = () => {
  const context = useContext(MatrixContext);
  if (!context) {
    throw new Error('useMatrix must be used within a MatrixProvider');
  }
  return context;
};

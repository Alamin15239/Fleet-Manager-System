import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SyncStatus {
  connected: boolean;
  lastSync: string | null;
  syncing: boolean;
  error: string | null;
}

export function useRealtimeSync() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<SyncStatus>({
    connected: false,
    lastSync: null,
    syncing: false,
    error: null
  });

  useEffect(() => {
    const socketInstance = io(process.env.NODE_ENV === 'production' 
      ? window.location.origin 
      : 'http://localhost:3000', {
      path: '/api/socketio'
    });

    socketInstance.on('connect', () => {
      setStatus(prev => ({ ...prev, connected: true, error: null }));
    });

    socketInstance.on('sync-update', (data) => {
      setStatus(prev => ({ 
        ...prev, 
        lastSync: data.timestamp,
        syncing: false 
      }));
    });

    socketInstance.on('sync-error', (data) => {
      setStatus(prev => ({ 
        ...prev, 
        error: data.error,
        syncing: false 
      }));
    });

    socketInstance.on('disconnect', () => {
      setStatus(prev => ({ ...prev, connected: false }));
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const triggerSync = async (action: 'deploy' | 'sync-db' | 'build') => {
    setStatus(prev => ({ ...prev, syncing: true, error: null }));
    
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setStatus(prev => ({ 
          ...prev, 
          lastSync: new Date().toISOString(),
          syncing: false 
        }));
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      setStatus(prev => ({ 
        ...prev, 
        error: error.message,
        syncing: false 
      }));
    }
  };

  return { status, triggerSync, socket };
}
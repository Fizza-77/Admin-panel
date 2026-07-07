'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import ConnectionLossOverlay from '@/components/ConnectionLossOverlay';
import {
  retryConnection,
  startConnectionMonitor,
  subscribeConnectionState,
  type ConnectionState,
} from '@/lib/client/connectionMonitor';
import { ConnectionContext } from '@/lib/ui/connectionState';

export default function ConnectionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConnectionState>('online');
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const stopMonitor = startConnectionMonitor();
    const unsubscribe = subscribeConnectionState(setState);
    return () => {
      unsubscribe();
      stopMonitor();
    };
  }, []);

  const retry = useCallback(async () => {
    setRetrying(true);
    try {
      return await retryConnection();
    } finally {
      setRetrying(false);
    }
  }, []);

  return (
    <ConnectionContext.Provider value={{ state, retry }}>
      {state === 'lost' ? <ConnectionLossOverlay retrying={retrying} onRetry={() => void retry()} /> : null}
      {children}
    </ConnectionContext.Provider>
  );
}

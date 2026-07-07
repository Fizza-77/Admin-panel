'use client';

import { createContext, useContext } from 'react';
import type { ConnectionState } from '@/lib/client/connectionMonitor';

type ConnectionContextValue = {
  state: ConnectionState;
  retry: () => Promise<boolean>;
};

export const ConnectionContext = createContext<ConnectionContextValue>({
  state: 'online',
  retry: async () => true,
});

export function useConnectionState() {
  return useContext(ConnectionContext);
}

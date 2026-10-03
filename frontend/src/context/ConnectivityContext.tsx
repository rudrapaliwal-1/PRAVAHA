import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ConnectivityMode, SyncStatus } from '../types';
import { setApiConnectivityMode, getApiConnectivityMode, apiService } from '../services/api';

export interface ConnectivityContextType {
  connectionMode: ConnectivityMode;
  syncStatus: SyncStatus;
  isOffline: boolean;
  isLowConnectivity: boolean;
  cachedTimestamp: string | null;
  setMode: (mode: ConnectivityMode) => void;
  simulateOffline: () => void;
  restoreOnline: () => void;
  toggleSimulateOffline: () => void;
}

const ConnectivityContext = createContext<ConnectivityContextType | undefined>(undefined);

export const ConnectivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectionMode, setConnectionModeState] = useState<ConnectivityMode>(() => {
    return getApiConnectivityMode();
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [cachedTimestamp, setCachedTimestamp] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('missionpath_cache_timestamp') : null;
  });

  // Keep API service and localStorage synced
  const setMode = useCallback((newMode: ConnectivityMode) => {
    const previousMode = connectionMode;
    setConnectionModeState(newMode);
    setApiConnectivityMode(newMode);

    // Broadcast globally
    window.dispatchEvent(
      new CustomEvent('missionpath:connectivity', {
        detail: { mode: newMode, previousMode },
      })
    );

    // If transitioning back to ONLINE from OFFLINE or LOW_CONNECTIVITY:
    if (newMode === 'ONLINE' && previousMode !== 'ONLINE') {
      setSyncStatus('syncing');

      // Trigger live background fetch to resynchronize cache
      Promise.all([
        apiService.getLogisticsState().catch(() => null),
        apiService.getResilience().catch(() => null),
        apiService.getShortages().catch(() => null),
      ]).then(() => {
        const nowIso = new Date().toISOString();
        setCachedTimestamp(nowIso);
        if (typeof window !== 'undefined') {
          localStorage.setItem('missionpath_cache_timestamp', nowIso);
        }

        // Show SYNCING... for 1.4s, then show ✓ DATA SYNCHRONIZED
        setTimeout(() => {
          setSyncStatus('synced');

          // Keep ✓ DATA SYNCHRONIZED visible for 3s before returning to idle
          setTimeout(() => {
            setSyncStatus('idle');
          }, 3000);
        }, 1400);
      });
    } else {
      setSyncStatus('idle');
    }
  }, [connectionMode]);

  const simulateOffline = useCallback(() => {
    setMode('OFFLINE');
  }, [setMode]);

  const restoreOnline = useCallback(() => {
    setMode('ONLINE');
  }, [setMode]);

  const toggleSimulateOffline = useCallback(() => {
    if (connectionMode === 'OFFLINE') {
      restoreOnline();
    } else {
      simulateOffline();
    }
  }, [connectionMode, restoreOnline, simulateOffline]);

  // Update cached timestamp when localStorage changes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'missionpath_cache_timestamp') {
        setCachedTimestamp(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value: ConnectivityContextType = {
    connectionMode,
    syncStatus,
    isOffline: connectionMode === 'OFFLINE',
    isLowConnectivity: connectionMode === 'LOW_CONNECTIVITY',
    cachedTimestamp,
    setMode,
    simulateOffline,
    restoreOnline,
    toggleSimulateOffline,
  };

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
};

export const useConnectivity = (): ConnectivityContextType => {
  const context = useContext(ConnectivityContext);
  if (!context) {
    throw new Error('useConnectivity must be used within a ConnectivityProvider');
  }
  return context;
};

export default ConnectivityContext;

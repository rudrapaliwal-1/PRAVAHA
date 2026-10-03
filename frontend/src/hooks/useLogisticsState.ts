import { useState, useEffect, useCallback } from 'react';
import { LogisticsState, ResilienceScore } from '../types';
import { apiService } from '../services/api';

export interface LogisticsStateHook {
  state: LogisticsState | null;
  resilience: ResilienceScore | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

export function useLogisticsState(autoRefreshIntervalMs = 10000): LogisticsStateHook {
  const [state, setState] = useState<LogisticsState | null>(null);
  const [resilience, setResilience] = useState<ResilienceScore | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch state and resilience concurrently
      const [stateData, resilienceData] = await Promise.all([
        apiService.getLogisticsState(),
        apiService.getResilience().catch(() => null),
      ]);

      setState(stateData);
      setResilience(resilienceData);
      setConnected(true);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.warn('Backend API connection error:', err);
      setError(err?.message || 'Failed to connect to backend service.');
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    if (autoRefreshIntervalMs > 0) {
      const timer = setInterval(() => {
        fetchData();
      }, autoRefreshIntervalMs);
      return () => clearInterval(timer);
    }
  }, [fetchData, autoRefreshIntervalMs]);

  return {
    state,
    resilience,
    loading,
    error,
    connected,
    lastUpdated,
    refresh: fetchData,
  };
}

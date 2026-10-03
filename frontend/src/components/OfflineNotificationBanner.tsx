import React from 'react';
import {
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Database,
  Radio,
  WifiOff,
  SignalMedium,
} from 'lucide-react';
import { useConnectivity } from '../context/ConnectivityContext';

export const OfflineNotificationBanner: React.FC = () => {
  const {
    connectionMode,
    syncStatus,
    isOffline,
    isLowConnectivity,
    cachedTimestamp,
    restoreOnline,
  } = useConnectivity();

  // If online and not syncing/synced, do not display banner
  if (connectionMode === 'ONLINE' && syncStatus === 'idle') {
    return null;
  }

  // SYNCING... State
  if (syncStatus === 'syncing') {
    return (
      <div className="p-3.5 rounded-xl border border-cyan-500/50 bg-gradient-to-r from-cyan-950/60 to-slate-900/80 text-cyan-200 flex items-center justify-between gap-3 shadow-lg font-mono text-xs animate-pulse">
        <div className="flex items-center gap-2.5">
          <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-cyan-300 uppercase tracking-wider">
              SYNCING...
            </span>
            <span className="text-slate-400">
              Re-establishing telemetry handshake with backend port 8000 and CP-SAT engine.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ✓ DATA SYNCHRONIZED State
  if (syncStatus === 'synced') {
    return (
      <div className="p-3.5 rounded-xl border border-emerald-500/50 bg-gradient-to-r from-emerald-950/60 to-slate-900/80 text-emerald-200 flex items-center justify-between gap-3 shadow-lg font-mono text-xs transition-all">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-emerald-300 uppercase tracking-wider">
              ✓ DATA SYNCHRONIZED
            </span>
            <span className="text-slate-300">
              Cache refreshed with live operational world state and resilience metrics.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // OFFLINE State
  if (isOffline) {
    const formattedTime = cachedTimestamp
      ? new Date(cachedTimestamp).toLocaleTimeString()
      : 'Local Memory';

    return (
      <div className="p-3.5 md:p-4 rounded-xl border border-rose-500/60 bg-gradient-to-r from-rose-950/70 via-slate-950/80 to-slate-900/90 text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_0_20px_rgba(244,63,94,0.15)] font-mono text-xs">
        <div className="flex items-start gap-3">
          <span className="text-xl shrink-0 mt-0.5">🔴</span>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold uppercase tracking-wider text-rose-400">
                OFFLINE MODE ACTIVE // DISPLAYING LOCAL CACHED TELEMETRY
              </span>
              <span className="px-2 py-0.2 rounded bg-rose-950 border border-rose-500/40 text-[10px] text-rose-300">
                Snapshot: {formattedTime}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-snug font-sans">
              Live backend communication is disabled. Operations requiring solver execution, disruption injection, or copilot queries are temporarily locked. <strong>The dashboard, live map, fleet, and inventory remain fully usable with cached data.</strong>
            </p>
          </div>
        </div>

        <button
          onClick={restoreOnline}
          className="shrink-0 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold transition shadow-md shadow-rose-950/60 whitespace-nowrap self-start sm:self-center"
        >
          RESTORE CONNECTION
        </button>
      </div>
    );
  }

  // LOW CONNECTIVITY State
  if (isLowConnectivity) {
    return (
      <div className="p-3 rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-950/60 to-slate-900/80 text-amber-200 flex items-center justify-between gap-3 shadow-md font-mono text-xs">
        <div className="flex items-center gap-2.5">
          <span className="text-base shrink-0">🪖</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold uppercase tracking-wider text-amber-400">
              LOW CONNECTIVITY MODE:
            </span>
            <span className="text-slate-300">
              Simulated satellite degradation active. High transit latency (~1200ms) applied to all queries.
            </span>
          </div>
        </div>

        <button
          onClick={restoreOnline}
          className="shrink-0 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-mono text-[11px] font-bold transition whitespace-nowrap"
        >
          RESTORE FULL BANDWIDTH
        </button>
      </div>
    );
  }

  return null;
};

export default OfflineNotificationBanner;

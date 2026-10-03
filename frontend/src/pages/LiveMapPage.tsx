import { RefreshCw } from 'lucide-react';
import { LiveLogisticsMap } from '../components/LiveLogisticsMap';
import { useLogisticsState } from '../hooks/useLogisticsState';

export const LiveMapPage: React.FC = () => {
  const { state, loading, connected, refresh } = useLogisticsState(10000);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-[10px] font-mono font-semibold text-cyan-400">
              GIS-02 // SPATIAL-VIEW
            </span>
            <span className="text-xs font-mono text-slate-500">
              COORDINATES: 30.3165° N, 78.0322° E • UTTARAKHAND
            </span>
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-white mt-1">
            Live Tactical Operations Map
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time geospatial tracking of fleet convoys, supply depots, relief demand sites, and blocked corridor hazards.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono ${
              connected
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-950/70 border-amber-500/40 text-amber-300'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>{connected ? 'LIVE /api/state' : 'OFFLINE BUFFER'}</span>
          </div>

          <button
            onClick={() => refresh()}
            disabled={loading}
            className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
            title="Refresh map telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Full-Height Tactical Map */}
      <LiveLogisticsMap
        state={state}
        loading={loading}
        onRefresh={refresh}
        heightClass="h-[680px] xl:h-[740px]"
      />
    </div>
  );
};

import React, { useState } from 'react';
import {
  Layers,
  Crosshair,
  Maximize2,
  Minimize2,
  Compass,
  Truck,
  Boxes,
  Users,
  AlertTriangle,
  Radio,
} from 'lucide-react';

export const MapPlaceholder: React.FC = () => {
  const [activeLayers, setActiveLayers] = useState({
    fleet: true,
    depots: true,
    demand: true,
    hazards: true,
  });

  const [mapMode, setMapMode] = useState<'tactical' | 'satellite' | 'topo'>('tactical');
  const [fullscreen, setFullscreen] = useState(false);

  const toggleLayer = (layer: keyof typeof activeLayers) => {
    setActiveLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  return (
    <div
      className={`relative bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col shadow-sm transition-all duration-300 ${
        fullscreen ? 'fixed inset-4 z-50 rounded-xl border-cyan-500/50 shadow-2xl' : 'h-[500px] xl:h-[540px]'
      }`}
    >
      {/* Top Corner HUD Accent */}
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-500/50 z-20 pointer-events-none" />

      {/* Map Control Toolbar */}
      <div className="px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 z-20 backdrop-blur font-mono text-xs">
        {/* Layer Filter Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Layers:
          </span>

          <button
            onClick={() => toggleLayer('fleet')}
            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 border transition-all ${
              activeLayers.fleet
                ? 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300 shadow-glow-cyan'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <Truck className="w-3 h-3" /> Convoys (24)
          </button>

          <button
            onClick={() => toggleLayer('depots')}
            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 border transition-all ${
              activeLayers.depots
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <Boxes className="w-3 h-3" /> Depots (5)
          </button>

          <button
            onClick={() => toggleLayer('demand')}
            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 border transition-all ${
              activeLayers.demand
                ? 'bg-amber-950/70 border-amber-500/40 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <Users className="w-3 h-3" /> Demand (18)
          </button>

          <button
            onClick={() => toggleLayer('hazards')}
            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 border transition-all ${
              activeLayers.hazards
                ? 'bg-rose-950/70 border-rose-500/40 text-rose-300 shadow-glow-red'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <AlertTriangle className="w-3 h-3" /> Hazards (3)
          </button>
        </div>

        {/* View Mode & Viewport Controls */}
        <div className="flex items-center gap-2">
          {/* Map style selector */}
          <div className="hidden sm:flex items-center bg-slate-950 rounded p-0.5 border border-slate-800 text-[10px]">
            <button
              onClick={() => setMapMode('tactical')}
              className={`px-2 py-0.5 rounded transition-colors ${
                mapMode === 'tactical' ? 'bg-cyan-950 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              TACTICAL
            </button>
            <button
              onClick={() => setMapMode('satellite')}
              className={`px-2 py-0.5 rounded transition-colors ${
                mapMode === 'satellite' ? 'bg-cyan-950 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              SATELLITE
            </button>
            <button
              onClick={() => setMapMode('topo')}
              className={`px-2 py-0.5 rounded transition-colors ${
                mapMode === 'topo' ? 'bg-cyan-950 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              TOPO
            </button>
          </div>

          <button
            className="p-1.5 rounded bg-slate-900 border border-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Recenter Map on Active Convoys"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-1.5 rounded bg-slate-900 border border-slate-700 text-slate-400 hover:text-white transition-colors"
            title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Map Viewport Area */}
      <div className="relative flex-1 bg-slate-950 overflow-hidden flex items-center justify-center tactical-grid select-none">
        {/* Radar Ring Graphic */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
          <div className="w-[520px] h-[520px] rounded-full border border-cyan-500/20 animate-pulse" />
          <div className="absolute w-[360px] h-[360px] rounded-full border border-cyan-500/25" />
          <div className="absolute w-[200px] h-[200px] rounded-full border border-cyan-500/35" />
          <div className="absolute w-full h-[1px] bg-cyan-500/15" />
          <div className="absolute h-full w-[1px] bg-cyan-500/15" />
        </div>

        {/* Visual Route Corridor Lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Active Corridor Path 1 */}
          <path
            d="M 220 280 Q 320 210, 480 190 T 640 140"
            fill="none"
            stroke="rgba(6, 182, 212, 0.45)"
            strokeWidth="3"
            strokeDasharray="6 4"
            className="animate-pulse"
          />
          {/* Alternative Detour Path */}
          <path
            d="M 220 280 Q 280 340, 420 310 T 640 140"
            fill="none"
            stroke="rgba(16, 185, 129, 0.5)"
            strokeWidth="2.5"
            strokeDasharray="4 4"
          />
          {/* Blocked Path (Red) */}
          <path
            d="M 330 220 L 400 205"
            fill="none"
            stroke="rgba(239, 68, 68, 0.8)"
            strokeWidth="4"
          />
        </svg>

        {/* Simulated Map Pins & Nodes */}
        {/* Depot Alpha */}
        {activeLayers.depots && (
          <div className="absolute left-[200px] top-[260px] group cursor-pointer">
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-cyan-400 opacity-60" />
              <div className="w-5 h-5 rounded-md bg-cyan-950 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 shadow-glow-cyan z-10">
                <Boxes className="w-3 h-3" />
              </div>
            </div>
            {/* Tooltip */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-7 bg-slate-900/95 border border-cyan-500/50 rounded p-1.5 text-[10px] font-mono text-slate-200 whitespace-nowrap shadow-xl z-30 pointer-events-none group-hover:scale-105 transition-transform">
              <div className="font-bold text-cyan-400">DEPOT-ALPHA (Dehradun HQ)</div>
              <div className="text-slate-400">Inventory: 76.5T • 24 Vehicles</div>
            </div>
          </div>
        )}

        {/* Convoy MSN-7041 in transit */}
        {activeLayers.fleet && (
          <div className="absolute left-[380px] top-[190px] group cursor-pointer">
            <div className="relative flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-emerald-950 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 shadow-glow-green z-10">
                <Truck className="w-3 h-3 animate-pulse" />
              </div>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 bottom-8 bg-slate-900/95 border border-emerald-500/50 rounded p-1.5 text-[10px] font-mono text-slate-200 whitespace-nowrap shadow-xl z-30 pointer-events-none">
              <div className="font-bold text-emerald-400">CONVOY MSN-7041 (VEH-01)</div>
              <div className="text-slate-300">5.2T Medical/Water • 58 km/h • ETA: 42m</div>
            </div>
          </div>
        )}

        {/* Blocked Landslide Hazard */}
        {activeLayers.hazards && (
          <div className="absolute left-[340px] top-[210px] group cursor-pointer">
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-7 w-7 rounded-full bg-rose-500 opacity-70" />
              <div className="w-6 h-6 rounded-full bg-rose-950 border-2 border-rose-500 flex items-center justify-center text-rose-300 shadow-glow-red z-10">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 bottom-8 bg-slate-900/95 border border-rose-500/60 rounded p-1.5 text-[10px] font-mono text-slate-200 whitespace-nowrap shadow-xl z-30 pointer-events-none">
              <div className="font-bold text-rose-400">HAZARD: NH-58 LANDSLIDE</div>
              <div className="text-slate-300">Corridor Blocked • Bypass-7B Active</div>
            </div>
          </div>
        )}

        {/* Demand Site 01 (Tehri) */}
        {activeLayers.demand && (
          <div className="absolute left-[620px] top-[130px] group cursor-pointer">
            <div className="relative flex items-center justify-center">
              <div className="w-5 h-5 rounded-md bg-amber-950 border-2 border-amber-400 flex items-center justify-center text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)] z-10">
                <Users className="w-3 h-3" />
              </div>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 bottom-7 bg-slate-900/95 border border-amber-500/50 rounded p-1.5 text-[10px] font-mono text-slate-200 whitespace-nowrap shadow-xl z-30 pointer-events-none">
              <div className="font-bold text-amber-400">DEMAND-01 (Tehri Garhwal)</div>
              <div className="text-slate-300">P1 Critical • 2,400 Civilians • Need: Med/H2O</div>
            </div>
          </div>
        )}

        {/* Center Tactical Overlay Card */}
        <div className="z-10 text-center max-w-sm p-4 rounded-xl bg-slate-950/80 border border-slate-700/80 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-center gap-2 text-cyan-400 font-mono text-xs font-bold uppercase tracking-wider mb-1">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>Tactical GIS Geospatial Engine</span>
          </div>
          <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
            Live vector coordinates, route waypoints, and asset telemetry active. GIS map renderer container placeholder initialized.
          </p>
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>SECTOR: 44R VT 8812</span>
            <span className="text-emerald-400 font-semibold">FEED: SYNCED</span>
          </div>
        </div>

        {/* HUD Coordinate Stamp (Top Left) */}
        <div className="absolute top-3 left-3 bg-slate-950/80 border border-slate-800/80 rounded px-2.5 py-1.5 font-mono text-[10px] text-slate-400 space-y-0.5 pointer-events-none backdrop-blur">
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
            <Compass className="w-3 h-3" />
            <span>GEO VIEWPORT: UTTARAKHAND</span>
          </div>
          <div>BOUNDS: 30°19'N, 78°02'E</div>
          <div>DATUM: WGS-84 / UTM ZONE 44N</div>
        </div>

        {/* HUD Telemetry Stamp (Bottom Right) */}
        <div className="absolute bottom-3 right-3 bg-slate-950/80 border border-slate-800/80 rounded px-2.5 py-1.5 font-mono text-[10px] text-slate-400 space-y-0.5 pointer-events-none backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <span>GRID SCALE: 1 : 50,000</span>
            <span className="text-emerald-400 font-bold">GPS LOCK</span>
          </div>
          <div className="text-slate-500">REFRESH RATE: 1000ms</div>
        </div>
      </div>
    </div>
  );
};

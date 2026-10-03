import React from 'react';
import { useOperationalMode } from '../context/OperationalModeContext';
import { OperationalMode } from '../types/operationalMode';

interface OperationalModeSelectorProps {
  compact?: boolean;
  showDescription?: boolean;
}

export const OperationalModeSelector: React.FC<OperationalModeSelectorProps> = ({
  compact = false,
  showDescription = false,
}) => {
  const { mode, setMode, config } = useOperationalMode();

  const handleSelectMode = (newMode: OperationalMode) => {
    if (newMode !== mode) {
      setMode(newMode);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center rounded-lg bg-slate-950/90 border border-slate-800 p-0.5 shadow-inner">
        <button
          onClick={() => handleSelectMode('DISASTER_RESPONSE')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
            mode === 'DISASTER_RESPONSE'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Switch to Disaster Response Mode (Hospitals, Relief Camps, Evacuation Shelters)"
        >
          <span className="text-sm">🚨</span>
          <span className="hidden md:inline">DISASTER RESPONSE</span>
          <span className="md:hidden">RELIEF</span>
        </button>

        <button
          onClick={() => handleSelectMode('MILITARY_LOGISTICS')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
            mode === 'MILITARY_LOGISTICS'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Switch to Military Logistics Support Mode (Forward Bases, Vehicle Logistics, Bulk Fuel & Supplies)"
        >
          <span className="text-sm">🪖</span>
          <span className="hidden md:inline">MILITARY LOGISTICS</span>
          <span className="md:hidden">MILITARY</span>
        </button>
      </div>
    );
  }

  // Full Expanded Selector with visual cards
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
          <span>Operational Theater Mode:</span>
        </span>
        <span className="text-[10px] font-mono text-slate-500">
          Google OR-Tools Optimization Engine Unchanged
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Mode 1: Disaster Response */}
        <button
          onClick={() => handleSelectMode('DISASTER_RESPONSE')}
          className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
            mode === 'DISASTER_RESPONSE'
              ? 'border-cyan-500 bg-cyan-950/40 shadow-[0_0_20px_rgba(6,182,212,0.2)] ring-1 ring-cyan-500/50'
              : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/60'
          }`}
        >
          {mode === 'DISASTER_RESPONSE' && (
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500 text-slate-950">
              ACTIVE
            </div>
          )}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🚨</span>
            <span className="font-mono text-xs font-bold text-slate-100 uppercase tracking-wide">
              Disaster Response
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Relief operations for hospitals, emergency camps, shelters, medical supplies, food & water.
          </p>
        </button>

        {/* Mode 2: Military Logistics Support */}
        <button
          onClick={() => handleSelectMode('MILITARY_LOGISTICS')}
          className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
            mode === 'MILITARY_LOGISTICS'
              ? 'border-emerald-500 bg-emerald-950/40 shadow-[0_0_20px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/50'
              : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/60'
          }`}
        >
          {mode === 'MILITARY_LOGISTICS' && (
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500 text-slate-950">
              ACTIVE
            </div>
          )}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🪖</span>
            <span className="font-mono text-xs font-bold text-slate-100 uppercase tracking-wide">
              Military Logistics Support
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            Sustainment supply lines, forward bases, vehicle maintenance, bulk fuel, food, and parts.
          </p>
        </button>
      </div>

      {showDescription && (
        <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px] font-mono text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-bold">Context:</span>
            <span>{config.tagline}</span>
          </div>
          <span className="text-[10px] text-slate-500 shrink-0 ml-2">
            Dual-Use Transport Architecture
          </span>
        </div>
      )}
    </div>
  );
};

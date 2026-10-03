import React, { useState, useRef, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Signal,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  Database,
  Radio,
} from 'lucide-react';
import { useConnectivity } from '../context/ConnectivityContext';
import { ConnectivityMode } from '../types';

interface ConnectivityIndicatorProps {
  compact?: boolean;
}

export const ConnectivityIndicator: React.FC<ConnectivityIndicatorProps> = ({ compact = false }) => {
  const {
    connectionMode,
    syncStatus,
    setMode,
    toggleSimulateOffline,
    isOffline,
  } = useConnectivity();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format indicator text exactly as specified in Block 17
  const renderIndicatorContent = () => {
    if (syncStatus === 'syncing') {
      return (
        <span className="flex items-center gap-1.5 text-cyan-300 font-mono font-bold text-xs tracking-wider animate-pulse">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
          <span>SYNCING...</span>
        </span>
      );
    }

    if (syncStatus === 'synced') {
      return (
        <span className="flex items-center gap-1.5 text-emerald-300 font-mono font-bold text-xs tracking-wider">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>✓ DATA SYNCHRONIZED</span>
        </span>
      );
    }

    switch (connectionMode) {
      case 'LOW_CONNECTIVITY':
        return (
          <span className="flex items-center gap-1.5 text-amber-300 font-mono font-bold text-xs tracking-wider">
            <span>🪖</span>
            <span>LOW CONNECTIVITY</span>
          </span>
        );
      case 'OFFLINE':
        return (
          <span className="flex items-center gap-1.5 text-rose-300 font-mono font-bold text-xs tracking-wider">
            <span>🔴</span>
            <span>OFFLINE</span>
          </span>
        );
      case 'ONLINE':
      default:
        return (
          <span className="flex items-center gap-1.5 text-emerald-300 font-mono font-bold text-xs tracking-wider">
            <span>🪖</span>
            <span>ONLINE</span>
          </span>
        );
    }
  };

  const getContainerStyle = () => {
    if (syncStatus === 'syncing') {
      return 'bg-cyan-950/70 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]';
    }
    if (syncStatus === 'synced') {
      return 'bg-emerald-950/70 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
    }
    switch (connectionMode) {
      case 'OFFLINE':
        return 'bg-rose-950/70 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.25)]';
      case 'LOW_CONNECTIVITY':
        return 'bg-amber-950/70 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]';
      case 'ONLINE':
      default:
        return 'bg-emerald-950/60 border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
    }
  };

  return (
    <div ref={menuRef} className="relative inline-flex items-center gap-2">
      {/* Primary Connection Indicator Badge */}
      <div
        onClick={() => setMenuOpen(!menuOpen)}
        className={`cursor-pointer px-2.5 py-1 rounded-lg border text-xs font-mono transition-all flex items-center gap-2 select-none ${getContainerStyle()}`}
        title="Click to change simulated network connectivity"
      >
        {renderIndicatorContent()}
        <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
      </div>

      {/* Demo Toggle Button: [ SIMULATE OFFLINE ] / [ RESTORE ONLINE ] */}
      <button
        onClick={toggleSimulateOffline}
        className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold uppercase tracking-wider transition border shadow-sm ${
          isOffline
            ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 animate-pulse'
            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700'
        }`}
        title={isOffline ? 'Restore live backend synchronization' : 'Simulate offline degraded environment'}
      >
        {isOffline ? 'RESTORE ONLINE' : 'SIMULATE OFFLINE'}
      </button>

      {/* Connectivity Mode Dropdown Menu */}
      {menuOpen && (
        <div className="absolute top-full mt-1.5 right-0 z-50 w-60 rounded-xl border border-slate-800 bg-slate-950/95 p-2 shadow-2xl backdrop-blur font-mono text-xs">
          <div className="px-2 py-1 text-[10px] text-slate-400 border-b border-slate-800/80 uppercase font-semibold mb-1">
            Simulate Connection Mode
          </div>

          {/* ONLINE */}
          <button
            onClick={() => {
              setMode('ONLINE');
              setMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition ${
              connectionMode === 'ONLINE'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>🪖</span>
              <span>ONLINE</span>
            </div>
            <span className="text-[10px] text-slate-500">Live API</span>
          </button>

          {/* LOW CONNECTIVITY */}
          <button
            onClick={() => {
              setMode('LOW_CONNECTIVITY');
              setMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition mt-1 ${
              connectionMode === 'LOW_CONNECTIVITY'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>🪖</span>
              <span>LOW CONNECTIVITY</span>
            </div>
            <span className="text-[10px] text-slate-500">~1200ms Lag</span>
          </button>

          {/* OFFLINE */}
          <button
            onClick={() => {
              setMode('OFFLINE');
              setMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition mt-1 ${
              connectionMode === 'OFFLINE'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <span>🔴</span>
              <span>OFFLINE</span>
            </div>
            <span className="text-[10px] text-slate-500">Cache Only</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ConnectivityIndicator;

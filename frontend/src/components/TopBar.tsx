import React from 'react';
import {
  Menu,
  Bell,
  Volume2,
  VolumeX,
  User,
  Clock,
  Radio,
} from 'lucide-react';
import { useClock } from '../hooks/useClock';
import { StatusBadge } from './StatusBadge';
import { OperationalModeSelector } from './OperationalModeSelector';
import { ConnectivityIndicator } from './ConnectivityIndicator';
import { useDemoFlow } from '../context/DemoFlowContext';
import { Zap } from 'lucide-react';

interface TopBarProps {
  onToggleMobileMenu: () => void;
  audioAlerts: boolean;
  onToggleAudio: () => void;
  activeTabTitle: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  onToggleMobileMenu,
  audioAlerts,
  onToggleAudio,
  activeTabTitle,
}) => {
  const { utcTime, localTime, dateStr } = useClock();
  const { isDemoActive, currentStep, startDemo, stopDemo } = useDemoFlow();

  return (
    <header className="h-16 bg-slate-950/90 border-b border-slate-800 px-4 flex items-center justify-between sticky top-0 z-30 backdrop-blur">
      {/* Left: Mobile hamburger & Active Section */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
          aria-label="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-slate-300 font-semibold">MISSIONPATH</span>
            <span className="text-slate-600">/</span>
            <span className="text-cyan-400 uppercase">{activeTabTitle}</span>
          </div>

          <div className="sm:hidden font-mono text-sm font-bold text-slate-200 uppercase">
            {activeTabTitle}
          </div>
        </div>
      </div>

      {/* Middle: Live Clock & Readiness Telemetry (Hidden on small mobile) */}
      <div className="hidden md:flex items-center gap-4">
        {/* UTC / Local Clock */}
        <div className="flex items-center gap-2 px-3 py-1 rounded bg-slate-900/80 border border-slate-800 font-mono text-xs text-slate-300">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-semibold text-slate-100">{utcTime}</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">{localTime}</span>
          <span className="text-slate-600">[{dateStr}]</span>
        </div>

        {/* Global Network Health */}
        <div className="hidden lg:flex items-center gap-2">
          <StatusBadge label="NETWORK: SECURE" variant="info" pulse size="sm" />
          <StatusBadge label="DEFCON 2: ELEVATED" variant="warning" size="sm" />
        </div>
      </div>

      {/* Operational Mode Selector, Simulated Connectivity Indicator & 3-Minute Demo Trigger */}
      <div className="flex items-center gap-2">
        {/* 3-Minute Hackathon Demo Launch Button (BLOCK 20) */}
        <button
          onClick={isDemoActive ? stopDemo : startDemo}
          className={`px-2.5 py-1.5 rounded-lg border font-mono text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
            isDemoActive
              ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse'
              : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-slate-950 shadow-glow-cyan'
          }`}
          title={isDemoActive ? 'Exit Live Demo' : 'Launch guided 3-minute hackathon judge walkthrough'}
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span className="hidden sm:inline">
            {isDemoActive ? `DEMO STAGE ${currentStep}/13` : '⚡ 3-MIN LIVE DEMO'}
          </span>
          <span className="sm:hidden">
            {isDemoActive ? `${currentStep}/13` : 'DEMO'}
          </span>
        </button>

        <OperationalModeSelector compact />
        <ConnectivityIndicator compact />
      </div>

      {/* Right: Actions, Notifications & Operator Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Audio Alerts Toggle */}
        <button
          onClick={onToggleAudio}
          className={`p-2 rounded border transition-colors ${
            audioAlerts
              ? 'bg-slate-900 text-cyan-400 border-slate-700 hover:bg-slate-800'
              : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
          }`}
          title={audioAlerts ? 'Audio Alerts Enabled' : 'Audio Alerts Muted'}
          aria-label="Toggle Audio Alerts"
        >
          {audioAlerts ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Disruption Alert Pill */}
        <button
          className="relative p-2 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          title="Active Disruption Alerts (3 Active)"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-mono font-bold text-white shadow-glow-red">
            3
          </span>
        </button>

        {/* Operator Profile */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-sm">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden xl:flex flex-col text-left">
            <span className="text-xs font-mono font-semibold text-slate-200">
              OPERATOR-01
            </span>
            <span className="text-[10px] font-mono text-emerald-400 tracking-wider">
              COMMAND AUTH: ACTIVE
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

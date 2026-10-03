import React from 'react';
import {
  LayoutDashboard,
  Map,
  Truck,
  Boxes,
  Users,
  Cpu,
  AlertTriangle,
  ShieldCheck,
  Bot,
  ChevronLeft,
  ChevronRight,
  Radio,
} from 'lucide-react';
import { NavigationTab, NavItemConfig } from '../types';
import { useOperationalMode } from '../context/OperationalModeContext';

interface SidebarProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const navItems: (NavItemConfig & { icon: React.ComponentType<{ className?: string }> })[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    badge: 'LIVE',
    badgeVariant: 'success',
    description: 'High-level operational overview & readiness telemetry',
  },
  {
    id: 'live-map',
    label: 'Live Map',
    icon: Map,
    badge: 'GIS',
    badgeVariant: 'default',
    description: 'Tactical geo-spatial view of assets, routes & hazards',
  },
  {
    id: 'fleet',
    label: 'Fleet',
    icon: Truck,
    badge: 'FLEET',
    badgeVariant: 'default',
    description: 'Real-time vehicle telemetry, payload & availability',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Boxes,
    badge: 'STOCK',
    badgeVariant: 'default',
    description: 'Supply depot reserves: medical, rations, water, fuel',
  },
  {
    id: 'demand',
    label: 'Demand',
    icon: Users,
    badge: 'DEMAND',
    badgeVariant: 'warning',
    description: 'Relief site requests, casualty counts & priority queues',
  },
  {
    id: 'optimization',
    label: 'Optimization',
    icon: Cpu,
    badge: 'OR-TOOLS',
    badgeVariant: 'default',
    description: 'CP-SAT multi-vehicle routing & dispatch solver',
  },
  {
    id: 'disruptions',
    label: 'Disruptions',
    icon: AlertTriangle,
    badge: 'HAZARDS',
    badgeVariant: 'danger',
    description: 'Simulate & monitor roadblocks, washouts & fleet hazards',
  },
  {
    id: 'resilience',
    label: 'Resilience',
    icon: ShieldCheck,
    badge: 'HEALTH',
    badgeVariant: 'success',
    description: 'Network redundancy, stress score & fallback paths',
  },
  {
    id: 'ai-copilot',
    label: 'AI Copilot',
    icon: Bot,
    badge: 'AI',
    badgeVariant: 'default',
    description: 'Grounded natural language logistics intelligence advisor',
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const { mode, config } = useOperationalMode();

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-slate-950/95 border-r border-slate-800/90 backdrop-blur transition-all duration-300 ease-in-out lg:static
          ${collapsed ? 'w-20' : 'w-64'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Branding Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900/40">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 shrink-0 shadow-glow-cyan">
              <Radio className="w-5 h-5 animate-pulse text-cyan-400" />
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0 transition-opacity duration-200">
                <span className="font-mono text-base font-bold tracking-wider text-slate-100 uppercase truncate">
                  Mission<span className="text-cyan-400">Path</span>
                </span>
                <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase truncate">
                  Command Ops Center
                </span>
              </div>
            )}
          </div>

          {/* Desktop Collapse Button */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Operational Mode Badge in Sidebar */}
        {!collapsed && (
          <div className="mx-3 mt-3 space-y-1.5">
            <div
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono flex items-center justify-between ${
                mode === 'DISASTER_RESPONSE'
                  ? 'border-cyan-500/40 bg-cyan-950/30 text-cyan-300'
                  : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-sm">{config.icon}</span>
                <span className="font-bold truncate text-[10px] tracking-wider uppercase">
                  {config.shortName}
                </span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            </div>
          </div>
        )}

        {/* Navigation List */}
        <nav className="flex-1 px-2.5 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full group flex items-center gap-3 px-3 py-2.5 rounded-md font-mono text-sm transition-all duration-150 relative text-left
                  ${
                    isActive
                      ? 'bg-cyan-950/50 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 border border-transparent'
                  }
                `}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-cyan-400 rounded-r shadow-glow-cyan" />
                )}

                <Icon
                  className={`w-5 h-5 shrink-0 transition-colors ${
                    isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />

                {!collapsed && (
                  <div className="flex-1 flex items-center justify-between min-w-0">
                    <span className="truncate font-medium">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase shrink-0 ml-1.5 ${
                          item.badgeVariant === 'danger'
                            ? 'bg-rose-950/80 text-rose-400 border-rose-500/30'
                            : item.badgeVariant === 'warning'
                            ? 'bg-amber-950/80 text-amber-400 border-amber-500/30'
                            : item.badgeVariant === 'success'
                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer / System Meta */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950">
          {!collapsed ? (
            <div className="flex flex-col gap-1 text-[11px] font-mono text-slate-500">
              <div className="flex justify-between items-center">
                <span>FastAPI Core:</span>
                <span className="text-emerald-400">STANDBY</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Frontend:</span>
                <span className="text-cyan-400">VITE+REACT</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-600 mt-1">
                <span>SECURITY CLEARANCE</span>
                <span className="text-slate-400">LEVEL 4</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center text-xs text-emerald-400 font-mono" title="FastAPI Core Standby">
              ●
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

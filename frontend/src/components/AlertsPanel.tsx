import React from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  Filter,
  RefreshCw,
  X,
  MapPin,
  Clock,
  Flame,
  Truck,
  GitFork,
  Boxes,
  ShieldAlert,
} from 'lucide-react';
import { Panel } from './Panel';
import { StatusBadge, StatusVariant } from './StatusBadge';
import { useRealtimeAlertsAndTimeline } from '../hooks/useRealtimeAlertsAndTimeline';
import { AlertLevel, AlertCategory, SystemAlert } from '../types';

export const AlertsPanel: React.FC = () => {
  const {
    alerts,
    allAlertsCount,
    criticalCount,
    warningCount,
    infoCount,
    successCount,
    activeFilter,
    setActiveFilter,
    dismissAlert,
    refreshAlerts,
    loading,
  } = useRealtimeAlertsAndTimeline();

  // Helper to map AlertLevel to visual styling
  const getLevelConfig = (level: AlertLevel): {
    variant: StatusVariant;
    borderColor: string;
    bgColor: string;
    textColor: string;
    icon: React.ReactNode;
  } => {
    switch (level) {
      case 'CRITICAL':
        return {
          variant: 'danger',
          borderColor: 'border-l-rose-500 border-rose-500/40',
          bgColor: 'bg-rose-950/20 hover:bg-rose-950/30',
          textColor: 'text-rose-400',
          icon: <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />,
        };
      case 'WARNING':
        return {
          variant: 'warning',
          borderColor: 'border-l-amber-500 border-amber-500/40',
          bgColor: 'bg-amber-950/20 hover:bg-amber-950/30',
          textColor: 'text-amber-400',
          icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
        };
      case 'SUCCESS':
        return {
          variant: 'success',
          borderColor: 'border-l-emerald-500 border-emerald-500/40',
          bgColor: 'bg-emerald-950/20 hover:bg-emerald-950/30',
          textColor: 'text-emerald-400',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
        };
      case 'INFO':
      default:
        return {
          variant: 'info',
          borderColor: 'border-l-cyan-500 border-cyan-500/40',
          bgColor: 'bg-cyan-950/20 hover:bg-cyan-950/30',
          textColor: 'text-cyan-400',
          icon: <Info className="w-4 h-4 text-cyan-400 shrink-0" />,
        };
    }
  };

  // Category Icon Resolver
  const getCategoryIcon = (category: AlertCategory) => {
    switch (category) {
      case 'shortage':
        return <Boxes className="w-3.5 h-3.5 text-rose-400" />;
      case 'route_blockage':
        return <GitFork className="w-3.5 h-3.5 text-rose-400" />;
      case 'vehicle_failure':
        return <Truck className="w-3.5 h-3.5 text-amber-400" />;
      case 'demand_surge':
        return <Flame className="w-3.5 h-3.5 text-amber-400" />;
      case 'reoptimization':
        return <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />;
      case 'plan_approval':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'resilience_change':
        return <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const filterTabs: { label: string; value: AlertLevel | 'ALL'; count: number }[] = [
    { label: 'ALL', value: 'ALL', count: allAlertsCount },
    { label: 'CRITICAL', value: 'CRITICAL', count: criticalCount },
    { label: 'WARNING', value: 'WARNING', count: warningCount },
    { label: 'INFO', value: 'INFO', count: infoCount },
    { label: 'SUCCESS', value: 'SUCCESS', count: successCount },
  ];

  return (
    <Panel
      title="Real-Time Active Alerts"
      subtitle="Operational Threat & Disruption Feed"
      icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}
      badge={
        <StatusBadge
          label={`${criticalCount} CRITICAL`}
          variant={criticalCount > 0 ? 'danger' : 'success'}
          pulse={criticalCount > 0}
          size="sm"
        />
      }
      headerRight={
        <button
          onClick={() => refreshAlerts()}
          disabled={loading}
          className="text-slate-400 hover:text-cyan-400 transition"
          title="Refresh Alerts from Backend"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      }
      bodyClassName="p-3 space-y-3"
    >
      {/* Alert Level Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800/80 font-mono text-[10px]">
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={`px-2 py-1 rounded transition flex items-center gap-1 font-bold whitespace-nowrap ${
                isActive
                  ? 'bg-slate-800 text-slate-100 border border-slate-600'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1 py-0.2 rounded text-[9px] ${
                  tab.value === 'CRITICAL'
                    ? 'bg-rose-950 text-rose-400 border border-rose-500/40'
                    : tab.value === 'WARNING'
                    ? 'bg-amber-950 text-amber-400 border border-amber-500/40'
                    : tab.value === 'SUCCESS'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                    : 'bg-slate-900 text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Alerts Feed List */}
      <div className="space-y-2.5 overflow-y-auto max-h-[290px] pr-1">
        {alerts.length > 0 ? (
          alerts.map((alert: SystemAlert) => {
            const config = getLevelConfig(alert.level);
            return (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border-l-4 border ${config.borderColor} ${config.bgColor} bg-slate-950/70 transition-all font-mono text-xs flex flex-col justify-between gap-1.5 shadow-sm relative group`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="mt-0.5">{config.icon}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[11px] font-bold ${config.textColor}`}>
                          {alert.title}
                        </span>
                      </div>
                      {alert.location && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{alert.location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge label={alert.level} variant={config.variant} size="sm" />
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition"
                      title="Dismiss Alert"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300 leading-snug font-sans pl-6">
                  {alert.description}
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 pl-6 text-[10px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    {getCategoryIcon(alert.category)}
                    <span className="uppercase">{alert.category.replace('_', ' ')}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        let targetTab = 'dashboard';
                        if (alert.category === 'shortage' || alert.category === 'demand_surge') targetTab = 'demand';
                        else if (alert.category === 'route_blockage') targetTab = 'disruptions';
                        else if (alert.category === 'vehicle_failure') targetTab = 'fleet';
                        else if (alert.category === 'reoptimization' || alert.category === 'plan_approval') targetTab = 'optimization';
                        else if (alert.category === 'resilience_change') targetTab = 'resilience';
                        window.dispatchEvent(new CustomEvent('missionpath:navigate', { detail: targetTab }));
                      }}
                      className="text-cyan-400 hover:text-cyan-300 hover:underline uppercase text-[9px] font-bold"
                    >
                      INVESTIGATE &rarr;
                    </button>
                    <span className="text-slate-600">|</span>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{alert.timestamp}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-6 text-center text-slate-500 text-xs font-mono">
            No active alerts matching filter. All network sectors nominal.
          </div>
        )}
      </div>
    </Panel>
  );
};

export default AlertsPanel;

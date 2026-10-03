import React, { useState, useMemo } from 'react';
import {
  Clock,
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  Truck,
  GitFork,
  Boxes,
  Flame,
  RotateCcw,
  Sparkles,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { Panel } from './Panel';
import { StatusBadge, StatusVariant } from './StatusBadge';
import { useRealtimeAlertsAndTimeline } from '../hooks/useRealtimeAlertsAndTimeline';
import { SystemTimelineEvent, AlertLevel } from '../types';

export const TimelinePanel: React.FC = () => {
  const { timelineEvents } = useRealtimeAlertsAndTimeline();
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [levelFilter, setLevelFilter] = useState<AlertLevel | 'ALL'>('ALL');

  // Resolve category icon
  const getEventCategoryIcon = (category: SystemTimelineEvent['category']) => {
    switch (category) {
      case 'dispatch':
        return <Activity className="w-3.5 h-3.5 text-cyan-400" />;
      case 'route_blockage':
        return <GitFork className="w-3.5 h-3.5 text-rose-400" />;
      case 'vehicle_failure':
        return <Truck className="w-3.5 h-3.5 text-amber-400" />;
      case 'demand_surge':
        return <Flame className="w-3.5 h-3.5 text-amber-400" />;
      case 'shortage':
        return <Boxes className="w-3.5 h-3.5 text-rose-400" />;
      case 'reoptimization':
        return <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />;
      case 'plan_approval':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'resilience_change':
        return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
      case 'system':
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  // Node and badge styling based on AlertLevel
  const getLevelStyle = (level: AlertLevel): {
    nodeBg: string;
    nodeBorder: string;
    badgeVariant: StatusVariant;
    textColor: string;
  } => {
    switch (level) {
      case 'CRITICAL':
        return {
          nodeBg: 'bg-rose-500',
          nodeBorder: 'border-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.6)]',
          badgeVariant: 'danger',
          textColor: 'text-rose-400',
        };
      case 'WARNING':
        return {
          nodeBg: 'bg-amber-500',
          nodeBorder: 'border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]',
          badgeVariant: 'warning',
          textColor: 'text-amber-400',
        };
      case 'SUCCESS':
        return {
          nodeBg: 'bg-emerald-500',
          nodeBorder: 'border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
          badgeVariant: 'success',
          textColor: 'text-emerald-400',
        };
      case 'INFO':
      default:
        return {
          nodeBg: 'bg-cyan-500',
          nodeBorder: 'border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]',
          badgeVariant: 'info',
          textColor: 'text-cyan-400',
        };
    }
  };

  // Processed and sorted events
  const displayEvents = useMemo(() => {
    let list = [...timelineEvents];

    if (levelFilter !== 'ALL') {
      list = list.filter((e) => e.level === levelFilter);
    }

    if (sortOrder === 'asc') {
      // Sort chronological (e.g. 10:32 -> 10:38)
      return list.sort((a, b) => a.time.localeCompare(b.time));
    } else {
      // Sort reverse chronological (newest first)
      return list.sort((a, b) => b.time.localeCompare(a.time));
    }
  }, [timelineEvents, sortOrder, levelFilter]);

  return (
    <Panel
      title="Event Timeline"
      subtitle="Chronological Ops & Disruption Sequence"
      icon={<Clock className="w-4 h-4 text-cyan-400" />}
      badge={<StatusBadge label="STREAMING" variant="info" pulse size="sm" />}
      headerRight={
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
            title="Toggle Sort Direction"
          >
            <ArrowUpDown className="w-3 h-3 text-cyan-400" />
            <span>{sortOrder === 'asc' ? 'CHRONOLOGICAL' : 'NEWEST FIRST'}</span>
          </button>
        </div>
      }
      bodyClassName="p-3 space-y-3"
    >
      {/* Level Filters */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 border-b border-slate-800/80 font-mono text-[10px]">
        <div className="flex items-center gap-1">
          {(['ALL', 'CRITICAL', 'WARNING', 'INFO', 'SUCCESS'] as const).map((lvl) => {
            const isActive = levelFilter === lvl;
            return (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`px-2 py-0.5 rounded transition font-bold whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-800 text-slate-100 border border-slate-600'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {lvl}
              </button>
            );
          })}
        </div>

        <span className="text-[10px] text-slate-500 whitespace-nowrap">
          {displayEvents.length} EVENTS
        </span>
      </div>

      {/* Timeline Stream */}
      <div className="relative border-l border-slate-800 ml-2 space-y-3.5 my-1 overflow-y-auto max-h-[300px] pr-1">
        {displayEvents.length > 0 ? (
          displayEvents.map((evt) => {
            const style = getLevelStyle(evt.level);
            return (
              <div key={evt.id} className="relative pl-5 group">
                {/* Timeline Connector Node */}
                <div
                  className={`absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-slate-950 border flex items-center justify-center transition-transform group-hover:scale-125 ${style.nodeBorder}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${style.nodeBg}`} />
                </div>

                {/* Event Card */}
                <div className="bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 rounded-lg p-2.5 font-mono transition-all">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    {/* Exact format: HH:MM — Event Title */}
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span className="text-xs font-bold text-cyan-400">
                        {evt.time}
                      </span>
                      <span className="text-slate-500 font-bold">—</span>
                      <span className="text-xs font-semibold text-slate-100">
                        {evt.title}
                      </span>
                    </div>

                    <StatusBadge label={evt.level} variant={style.badgeVariant} size="sm" />
                  </div>

                  {/* Detail */}
                  {evt.detail && (
                    <p className="text-[11px] text-slate-300 leading-snug font-sans mt-0.5">
                      {evt.detail}
                    </p>
                  )}

                  {/* Bottom Metadata & Category */}
                  <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-slate-800/60 text-[10px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                      {getEventCategoryIcon(evt.category)}
                      <span className="uppercase tracking-wider">
                        {evt.category.replace('_', ' ')}
                      </span>
                    </div>

                    {evt.entityId && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400 font-bold">
                        {evt.entityId}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-6 text-center text-slate-500 text-xs font-mono">
            No events found matching filter.
          </div>
        )}
      </div>
    </Panel>
  );
};

export default TimelinePanel;

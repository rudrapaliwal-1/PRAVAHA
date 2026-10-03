import React from 'react';
import { StatusBadge, StatusVariant } from './StatusBadge';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: string;
  statusText?: string;
  statusVariant?: StatusVariant;
  icon?: React.ReactNode;
  subtext?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  change,
  statusText,
  statusVariant = 'neutral',
  icon,
  subtext,
}) => {
  return (
    <div className="relative group bg-slate-900/70 border border-slate-800 hover:border-slate-700/80 rounded-lg p-4 transition-all duration-200 overflow-hidden shadow-sm">
      {/* Corner HUD accent */}
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-500/30 group-hover:border-cyan-500/70 transition-colors" />

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {icon && <div className="text-slate-400 group-hover:text-cyan-400 transition-colors">{icon}</div>}
          <span className="text-xs font-mono font-medium tracking-wider text-slate-400 uppercase">
            {title}
          </span>
        </div>
        {statusText && <StatusBadge label={statusText} variant={statusVariant} size="sm" />}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold font-mono tracking-tight text-slate-100">
          {value}
        </span>
        {unit && <span className="text-xs font-mono text-slate-400">{unit}</span>}
        {change && (
          <span className="text-xs font-mono font-medium text-emerald-400 ml-auto">
            {change}
          </span>
        )}
      </div>

      {subtext && (
        <div className="mt-2 text-xs text-slate-500 font-mono truncate">
          {subtext}
        </div>
      )}
    </div>
  );
};

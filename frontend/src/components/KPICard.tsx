import React from 'react';
import { StatusBadge, StatusVariant } from './StatusBadge';

export interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  statusText?: string;
  statusVariant?: StatusVariant;
  icon?: React.ReactNode;
  subtext?: string;
  progress?: number;
  alert?: boolean;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  unit,
  change,
  changeType = 'positive',
  statusText,
  statusVariant = 'neutral',
  icon,
  subtext,
  progress,
  alert = false,
}) => {
  return (
    <div
      className={`relative group bg-slate-900/80 border rounded-lg p-3.5 transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-sm backdrop-blur ${
        alert
          ? 'border-rose-500/60 shadow-glow-red hover:border-rose-400'
          : 'border-slate-800 hover:border-slate-700/80'
      }`}
    >
      {/* Tactical Top-Right HUD Accent */}
      <div
        className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 transition-colors ${
          alert
            ? 'border-rose-500/80'
            : 'border-cyan-500/40 group-hover:border-cyan-400'
        }`}
      />

      {/* Card Header: Icon, Title & Status */}
      <div>
        <div className="flex items-start justify-between gap-1 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {icon && (
              <div
                className={`transition-colors shrink-0 ${
                  alert
                    ? 'text-rose-400'
                    : 'text-slate-400 group-hover:text-cyan-400'
                }`}
              >
                {icon}
              </div>
            )}
            <span className="text-[11px] font-mono font-medium tracking-wider text-slate-400 uppercase truncate">
              {title}
            </span>
          </div>

          {statusText && (
            <div className="shrink-0">
              <StatusBadge label={statusText} variant={statusVariant} size="sm" />
            </div>
          )}
        </div>

        {/* Primary Metric Number & Unit */}
        <div className="flex items-baseline gap-1.5 mt-1">
          <span
            className={`text-xl sm:text-2xl font-bold font-mono tracking-tight ${
              alert ? 'text-rose-200' : 'text-slate-100'
            }`}
          >
            {value}
          </span>
          {unit && (
            <span className="text-[11px] font-mono text-slate-400 truncate">
              {unit}
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar (Optional) */}
      {typeof progress === 'number' && !isNaN(progress) && (
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              alert
                ? 'bg-rose-500'
                : progress > 80
                ? 'bg-emerald-500'
                : progress > 40
                ? 'bg-cyan-500'
                : 'bg-amber-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}

      {/* Card Footer: Change Trend & Context Subtext */}
      <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2 text-[10px] font-mono">
        {subtext && (
          <span className="text-slate-400 truncate flex-1" title={subtext}>
            {subtext}
          </span>
        )}
        {change && (
          <span
            className={`font-semibold shrink-0 ${
              changeType === 'positive'
                ? 'text-emerald-400'
                : changeType === 'negative'
                ? 'text-rose-400'
                : 'text-slate-400'
            }`}
          >
            {change}
          </span>
        )}
      </div>
    </div>
  );
};

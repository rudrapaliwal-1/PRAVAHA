import React from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  Info,
  Clock,
  MapPin,
  ChevronRight,
  X,
} from 'lucide-react';
import { StatusBadge, StatusVariant } from './StatusBadge';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AlertCardProps {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  timestamp: string;
  location?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  compact?: boolean;
}

export const AlertCard: React.FC<AlertCardProps> = ({
  id,
  title,
  description,
  severity,
  timestamp,
  location,
  actionLabel,
  onAction,
  onDismiss,
  compact = false,
}) => {
  const severityConfig: Record<
    AlertSeverity,
    {
      variant: StatusVariant;
      border: string;
      bg: string;
      icon: React.ReactNode;
      text: string;
    }
  > = {
    critical: {
      variant: 'danger',
      border: 'border-l-rose-500 border-rose-500/30',
      bg: 'bg-rose-950/20 hover:bg-rose-950/30',
      icon: <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />,
      text: 'text-rose-400',
    },
    high: {
      variant: 'warning',
      border: 'border-l-amber-500 border-amber-500/30',
      bg: 'bg-amber-950/20 hover:bg-amber-950/30',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
      text: 'text-amber-400',
    },
    medium: {
      variant: 'warning',
      border: 'border-l-amber-400 border-slate-700',
      bg: 'bg-slate-900/60 hover:bg-slate-800/60',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
      text: 'text-amber-400',
    },
    low: {
      variant: 'info',
      border: 'border-l-cyan-500 border-slate-700',
      bg: 'bg-slate-900/60 hover:bg-slate-800/60',
      icon: <Info className="w-4 h-4 text-cyan-400 shrink-0" />,
      text: 'text-cyan-400',
    },
    info: {
      variant: 'info',
      border: 'border-l-cyan-400 border-slate-700',
      bg: 'bg-slate-900/60 hover:bg-slate-800/60',
      icon: <Info className="w-4 h-4 text-cyan-400 shrink-0" />,
      text: 'text-cyan-400',
    },
  };

  const config = severityConfig[severity];

  if (compact) {
    return (
      <div
        className={`p-2.5 rounded-lg border-l-4 border bg-slate-950/80 ${config.border} flex items-center justify-between gap-3 text-xs font-mono transition-colors`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {config.icon}
          <div className="truncate">
            <span className="font-bold text-slate-200">{title}</span>
            <span className="text-slate-500 mx-1.5">•</span>
            <span className="text-slate-400">{description}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-slate-500">{timestamp}</span>
          <StatusBadge label={severity.toUpperCase()} variant={config.variant} size="sm" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-3.5 rounded-lg border-l-4 border ${config.border} ${config.bg} bg-slate-950/70 transition-all duration-150 flex flex-col justify-between gap-2.5 font-mono shadow-sm`}
    >
      {/* Top row: Icon, ID, Title, Severity Badge & Dismiss */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className="mt-0.5">{config.icon}</div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-bold ${config.text}`}>{id}</span>
              <span className="text-slate-500 text-[10px]">•</span>
              <span className="text-xs font-bold text-slate-200 truncate">{title}</span>
            </div>
            {location && (
              <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                <span className="truncate">{location}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <StatusBadge label={severity.toUpperCase()} variant={config.variant} size="sm" />
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition-colors"
              title="Dismiss Alert"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Description text */}
      <p className="text-xs text-slate-300 leading-relaxed font-sans pl-6">
        {description}
      </p>

      {/* Bottom meta & Action */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 pl-6 text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Clock className="w-3 h-3 text-slate-500" />
          <span>{timestamp}</span>
        </div>

        {actionLabel && (
          <button
            onClick={onAction}
            className={`font-semibold text-xs flex items-center gap-1 transition-colors ${
              severity === 'critical'
                ? 'text-rose-400 hover:text-rose-300'
                : 'text-cyan-400 hover:text-cyan-300'
            }`}
          >
            <span>{actionLabel}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

import React from 'react';

export type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'neutral',
  pulse = false,
  size = 'md',
  icon,
}) => {
  const variantStyles: Record<StatusVariant, { bg: string; text: string; dot: string; border: string; glow: string }> = {
    success: {
      bg: 'bg-emerald-950/70',
      text: 'text-emerald-400',
      dot: 'bg-emerald-400',
      border: 'border-emerald-500/40',
      glow: 'shadow-glow-green',
    },
    warning: {
      bg: 'bg-amber-950/70',
      text: 'text-amber-400',
      dot: 'bg-amber-400',
      border: 'border-amber-500/40',
      glow: 'shadow-[0_0_12px_rgba(245,158,11,0.25)]',
    },
    danger: {
      bg: 'bg-rose-950/70',
      text: 'text-rose-400',
      dot: 'bg-rose-400',
      border: 'border-rose-500/40',
      glow: 'shadow-glow-red',
    },
    info: {
      bg: 'bg-cyan-950/70',
      text: 'text-cyan-400',
      dot: 'bg-cyan-400',
      border: 'border-cyan-500/40',
      glow: 'shadow-glow-cyan',
    },
    neutral: {
      bg: 'bg-slate-900/80',
      text: 'text-slate-400',
      dot: 'bg-slate-400',
      border: 'border-slate-700/60',
      glow: '',
    },
  };

  const style = variantStyles[variant];
  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[10px]'
      : size === 'lg'
      ? 'px-3 py-1.5 text-xs tracking-wider'
      : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-semibold tracking-wider uppercase rounded border ${style.bg} ${style.text} ${style.border} ${style.glow} ${sizeClasses} transition-all duration-150`}
    >
      {icon ? (
        <span className="shrink-0">{icon}</span>
      ) : (
        <span className="relative flex h-2 w-2 shrink-0">
          {pulse && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${style.dot}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${style.dot}`} />
        </span>
      )}
      <span className="truncate">{label}</span>
    </span>
  );
};

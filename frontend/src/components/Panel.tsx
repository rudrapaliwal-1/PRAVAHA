import React from 'react';

export interface PanelProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  cornerAccent?: boolean;
  maxHeight?: string;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  subtitle,
  icon,
  badge,
  headerRight,
  children,
  className = '',
  bodyClassName = '',
  cornerAccent = true,
  maxHeight,
}) => {
  return (
    <div
      className={`relative bg-slate-900/70 border border-slate-800 rounded-lg flex flex-col overflow-hidden shadow-sm backdrop-blur transition-all duration-200 ${className}`}
    >
      {/* Top-Right HUD Accent */}
      {cornerAccent && (
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-500/40 pointer-events-none" />
      )}

      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <div className="text-cyan-400 shrink-0">{icon}</div>}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase truncate">
                {title}
              </h2>
              {badge && <div className="shrink-0">{badge}</div>}
            </div>
            {subtitle && (
              <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {headerRight && (
          <div className="flex items-center gap-2 shrink-0">
            {headerRight}
          </div>
        )}
      </div>

      {/* Panel Content Body */}
      <div
        className={`flex-1 p-4 ${bodyClassName}`}
        style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
      >
        {children}
      </div>
    </div>
  );
};

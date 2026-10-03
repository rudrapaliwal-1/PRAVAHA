import React from 'react';
import { AlertTriangle, Truck, Clock, PackageX, RotateCcw, ArrowRight, ShieldAlert } from 'lucide-react';
import { useDemoFlow } from '../context/DemoFlowContext';

export const DemoDisruptionAlertBanner: React.FC = () => {
  const { isDemoActive, currentStep, nextStep, stepData } = useDemoFlow();

  // Show if demo step 6 or 7 is active
  if (!isDemoActive || (currentStep !== 6 && currentStep !== 5)) {
    return null;
  }

  const affectedRoute = 'ROUTE-03';
  const affectedVehicles = ['VEH-01', 'VEH-04', 'VEH-07', 'VEH-09'];
  const affectedDeliveries = ['DEL-01 (Medical)', 'DEL-02 (Water)', 'DEL-03 (Food)', 'DEL-04 (Fuel)'];
  const previousEta = '2.4 hours';
  const revisedEta = '4.2 hours (+1.8h Delay)';

  return (
    <div className="rounded-xl border-2 border-rose-500/80 bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/60 p-4 sm:p-5 shadow-[0_0_35px_rgba(244,63,94,0.35)] font-mono animate-pulse">
      {/* Alert Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-rose-500/40 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-rose-600 text-slate-950 shadow-glow-red animate-bounce">
            <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="text-sm font-bold text-rose-400 uppercase tracking-wider">
              CRITICAL FIELD INCIDENT // STAGE 6
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>⚠ ROUTE DISRUPTION DETECTED</span>
            </h2>
          </div>
        </div>

        <button
          onClick={() => nextStep()}
          className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-glow-cyan shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>RE-OPTIMIZE NETWORK (STEP 7)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Required Affected Entities Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-3.5">
        {/* 1. Affected Route */}
        <div className="p-3 rounded-lg bg-slate-950/80 border border-rose-500/40 space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">
            AFFECTED ROUTE:
          </span>
          <div className="text-base font-bold text-rose-400">
            {affectedRoute}
          </div>
          <span className="text-[11px] text-slate-400 block">
            Tehri North Corridor (BREACHED)
          </span>
        </div>

        {/* 2. Affected Vehicles */}
        <div className="p-3 rounded-lg bg-slate-950/80 border border-rose-500/40 space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">
            AFFECTED VEHICLES:
          </span>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {affectedVehicles.map((v) => (
              <span
                key={v}
                className="px-1.5 py-0.5 rounded bg-rose-950 border border-rose-500/50 text-[10px] font-bold text-rose-300"
              >
                {v}
              </span>
            ))}
          </div>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            4 Transports stranded on route
          </span>
        </div>

        {/* 3. Affected Deliveries */}
        <div className="p-3 rounded-lg bg-slate-950/80 border border-rose-500/40 space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">
            AFFECTED DELIVERIES:
          </span>
          <div className="text-sm font-bold text-amber-400">
            {affectedDeliveries.length} Shipments Compromised
          </div>
          <span className="text-[10px] text-slate-400 block truncate">
            Medical, Water, Food, Fuel
          </span>
        </div>

        {/* 4. ETA Impact */}
        <div className="p-3 rounded-lg bg-slate-950/80 border border-rose-500/40 space-y-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">
            ETA SCHEDULE IMPACT:
          </span>
          <div className="text-sm font-bold text-rose-300">
            {revisedEta}
          </div>
          <span className="text-[10px] text-slate-500 block">
            Original ETA: {previousEta}
          </span>
        </div>
      </div>
    </div>
  );
};

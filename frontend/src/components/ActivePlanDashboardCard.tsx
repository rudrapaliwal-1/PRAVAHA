import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Navigation,
  ShieldCheck,
  DollarSign,
  Truck,
  PackageX,
  SlidersHorizontal,
  ArrowRight,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { useActivePlan } from '../hooks/useActivePlan';

export const ActivePlanDashboardCard: React.FC = () => {
  const { activePlan, plans, loading, actionLoading, rejectPlan } = useActivePlan();

  const handleNavigateToOptimization = () => {
    window.dispatchEvent(
      new CustomEvent('missionpath:navigate', { detail: 'optimization' })
    );
  };

  const handleRescindActivePlan = async () => {
    if (!activePlan) return;
    try {
      await rejectPlan(activePlan.id, 'Rescinded from dashboard by commander.');
    } catch (err) {
      console.error('Failed to rescind plan:', err);
    }
  };

  if (loading && !activePlan && plans.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 animate-pulse flex items-center justify-between">
        <div className="h-4 w-64 bg-slate-800 rounded" />
        <div className="h-8 w-32 bg-slate-800 rounded" />
      </div>
    );
  }

  // ACTIVE PLAN APPROVED STATE
  if (activePlan) {
    return (
      <div className="p-4 md:p-5 rounded-2xl border border-emerald-500/50 bg-gradient-to-r from-emerald-950/40 via-slate-900/70 to-slate-950/90 shadow-[0_0_25px_rgba(16,185,129,0.15)] relative overflow-hidden transition-all duration-300">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Approved Header & Identity */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/50">
                <CheckCircle2 className="w-3.5 h-3.5" />
                ✓ PLAN APPROVED
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-[11px] font-mono text-emerald-300 font-bold">
                {activePlan.name.replace('_', ' ')}
              </span>
              <span className="text-xs font-mono text-slate-400">
                [{activePlan.id}]
              </span>
              <span className="text-[10px] font-mono text-emerald-400/80 uppercase">
                • Active in Simulation State
              </span>
            </div>

            <p className="text-xs md:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Human logistics commander has authorized the{' '}
              <strong className="text-white font-mono">{activePlan.name.replace('_', ' ')}</strong>{' '}
              Course of Action. Dispatch coordinates and CP-SAT transit schedules are broadcast to convoys.
            </p>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2">
              {/* ETA */}
              <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 font-mono text-xs">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>ETA</span>
                </div>
                <span className="font-bold text-slate-100">
                  {Math.round(activePlan.eta * 60)} min
                </span>
              </div>

              {/* Distance */}
              <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 font-mono text-xs">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-indigo-400" />
                  <span>DISTANCE</span>
                </div>
                <span className="font-bold text-slate-100">
                  {activePlan.distance.toFixed(1)} km
                </span>
              </div>

              {/* Risk */}
              <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 font-mono text-xs">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>THREAT</span>
                </div>
                <span className="font-bold text-emerald-300">
                  {activePlan.risk <= 0.35 ? 'LOW' : activePlan.risk <= 0.65 ? 'MEDIUM' : 'HIGH'}
                </span>
              </div>

              {/* Cost */}
              <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 font-mono text-xs">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-amber-400" />
                  <span>COST</span>
                </div>
                <span className="font-bold text-slate-100">
                  {Math.round(activePlan.cost).toLocaleString()}
                </span>
              </div>

              {/* Deliveries */}
              <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 font-mono text-xs">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Truck className="w-3 h-3 text-blue-400" />
                  <span>CONVOYS</span>
                </div>
                <span className="font-bold text-slate-100">
                  {activePlan.deliveries?.length || 0}
                </span>
              </div>

              {/* Unmet Demand */}
              <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 font-mono text-xs">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <PackageX className="w-3 h-3 text-rose-400" />
                  <span>UNMET</span>
                </div>
                <span className={`font-bold ${activePlan.unmet_demand > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {activePlan.unmet_demand > 0 ? `${Math.round(activePlan.unmet_demand)}` : '0 (0%)'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="shrink-0 flex sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2">
            <button
              onClick={handleNavigateToOptimization}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-semibold transition"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>COA Control Panel</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleRescindActivePlan}
              disabled={actionLoading}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 text-[11px] font-mono transition disabled:opacity-50"
              title="Rescind plan authorization"
            >
              <XCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>Rescind / Reject Plan</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PENDING HUMAN APPROVAL STATE (No plan approved yet)
  return (
    <div className="p-4 md:p-5 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-slate-900/70 to-slate-950/90 shadow-[0_0_25px_rgba(245,158,11,0.12)] relative overflow-hidden transition-all duration-300">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              PENDING
            </span>
            <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
              OPERATIONAL PLAN: AWAITING HUMAN APPROVAL
            </span>
          </div>

          <p className="text-xs md:text-sm text-slate-300 max-w-3xl leading-relaxed">
            Autonomous execution is locked. 3 feasible Courses of Action (
            <span className="text-cyan-300 font-mono">FASTEST</span>,{' '}
            <span className="text-emerald-300 font-mono">LOWEST RISK</span>,{' '}
            <span className="text-purple-300 font-mono">RESOURCE EFFICIENT</span>
            ) are waiting for explicit human commander approval before dispatch coordinates are activated.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-2.5">
          <button
            onClick={handleNavigateToOptimization}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-bold transition shadow-md shadow-amber-950/50"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>REVIEW & APPROVE PLAN</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActivePlanDashboardCard;

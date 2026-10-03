import React, { useState, useEffect, useCallback } from 'react';
import {
  RotateCcw,
  Cpu,
  Clock,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Truck,
  ArrowRight,
  Boxes,
  Zap,
  MapPin,
  RefreshCw,
  Send,
  Layers,
  Sliders,
  Play,
  Check,
  ChevronDown,
  Activity,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { StatusBadge, StatusVariant } from '../components/StatusBadge';
import { LiveLogisticsMap } from '../components/LiveLogisticsMap';
import { CoursesOfActionView } from '../components/CoursesOfActionView';
import {
  ReoptimizationResult,
  ReoptimizeRequest,
  DisruptionRequest,
  LogisticsState,
  Route,
  Vehicle,
} from '../types';
import { apiService } from '../services/api';
import { useConnectivity } from '../context/ConnectivityContext';

const STEP_LABELS = [
  'ANALYZING DISRUPTION',
  'IDENTIFYING IMPACT',
  'RUNNING CP-SAT',
  'GENERATING NEW PLAN',
  'OPTIMIZATION COMPLETE',
];

export const OptimizationPage: React.FC = () => {
  const { isOffline } = useConnectivity();
  const [activeTabMode, setActiveTabMode] = useState<'coa' | 'reopt'>('coa');
  const [state, setState] = useState<LogisticsState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Stepper execution state
  const [isReoptimizing, setIsReoptimizing] = useState<boolean>(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0); // 0 = idle, 1..5 = steps
  const [reoptResult, setReoptResult] = useState<ReoptimizationResult | null>(null);

  // Selected disruption configuration to trigger re-optimization
  const [selectedDisruptionType, setSelectedDisruptionType] = useState<string>('BLOCK_ROUTE');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('ROUTE-03');

  // Load world state
  const loadInitialState = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getLogisticsState();
      setState(data);

      // Pre-select an active route or blocked route
      if (data && data.routes) {
        const routes = Object.values(data.routes);
        const blocked = routes.find((r: Route) => !r.available);
        if (blocked) {
          setSelectedTargetId(blocked.id);
        } else if (routes.length > 0) {
          setSelectedTargetId(routes[0].id);
        }
      }
    } catch (err: any) {
      console.error('Failed to load logistics state:', err);
      setError(err?.message || 'Unable to connect to optimization service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialState();
  }, [loadInitialState]);

  // Execute the exact 5-step re-optimization sequence
  const handleRunReoptimization = async () => {
    try {
      setIsReoptimizing(true);
      setError(null);
      setReoptResult(null);

      // STEP 1: ANALYZING DISRUPTION
      setActiveStepIndex(1);
      await new Promise((resolve) => setTimeout(resolve, 600));

      // STEP 2: IDENTIFYING IMPACT
      setActiveStepIndex(2);
      await new Promise((resolve) => setTimeout(resolve, 650));

      // STEP 3: RUNNING CP-SAT (Call backend POST /api/reoptimize)
      setActiveStepIndex(3);
      const payload: ReoptimizeRequest = {
        disruption: {
          type: selectedDisruptionType,
          target_id: selectedTargetId || 'ROUTE-03',
          parameters: {},
        },
      };

      const result: ReoptimizationResult = await apiService.postReoptimize(payload);

      // Fetch fresh state to keep map and UI strictly in sync with backend
      const freshState: LogisticsState = await apiService.getLogisticsState();
      setState(freshState);

      // STEP 4: GENERATING NEW PLAN
      setActiveStepIndex(4);
      await new Promise((resolve) => setTimeout(resolve, 600));

      // STEP 5: OPTIMIZATION COMPLETE
      setActiveStepIndex(5);
      setReoptResult(result);
      window.dispatchEvent(new CustomEvent('missionpath:reoptimize', { detail: result }));
    } catch (err: any) {
      console.error('Re-optimization failed:', err);
      setError(err?.message || 'CP-SAT re-optimization solver failed.');
      setActiveStepIndex(0);
    } finally {
      setIsReoptimizing(false);
    }
  };

  // Derive highlighted routes & vehicles from backend result
  const highlightedRoutes = reoptResult ? reoptResult.affected_routes || [] : [];
  const highlightedVehicles = reoptResult ? reoptResult.affected_vehicles || [] : [];

  // Parse new deliveries from result.new_plan
  const newDeliveries = reoptResult?.new_plan?.deliveries || [];

  // Parse unmet demand entries
  const unmetEntries = reoptResult?.unmet_demand
    ? Object.entries(reoptResult.unmet_demand).filter(([_, supplies]) =>
        Object.values(supplies).some((qty) => qty > 0)
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-mono font-semibold text-emerald-400">
              SOLVER-06 // RE-OPTIMIZATION ENGINE
            </span>
            <span className="text-xs font-mono text-slate-500">
              ENDPOINT: POST /api/reoptimize (Google OR-Tools CP-SAT)
            </span>
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-white mt-1">
            Dynamic Route Re-Optimization Experience
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Resolve disruption impacts, reroute compromised relief convoys, calculate delay variance, and minimize unmet demand.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge
            label={reoptResult ? `CP-SAT: ${reoptResult.optimization_status}` : 'SOLVER READY'}
            variant={reoptResult?.optimization_status === 'OPTIMAL' ? 'success' : 'info'}
            pulse={isReoptimizing}
            size="sm"
          />
        </div>
      </div>

      {/* Top Level Mode Switcher: Courses of Action vs Re-Optimizer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 rounded-xl bg-slate-900/90 border border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTabMode('coa')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition ${
              activeTabMode === 'coa'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-md shadow-cyan-950/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
            <span>Courses of Action (3 Plans)</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-500/30">
              STRATEGIC
            </span>
          </button>

          <button
            onClick={() => setActiveTabMode('reopt')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition ${
              activeTabMode === 'reopt'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-md shadow-emerald-950/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>Disruption Re-Optimizer</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-500/30">
              CP-SAT
            </span>
          </button>
        </div>

        <div className="text-xs font-mono text-slate-400 px-3 hidden md:block">
          {activeTabMode === 'coa'
            ? 'Candidate Trade-Off Analysis: FASTEST / LOWEST RISK / RESOURCE EFFICIENT'
            : '5-Step Reactive CP-SAT Disruption Mitigation Pipeline'}
        </div>
      </div>

      {activeTabMode === 'coa' ? (
        <CoursesOfActionView />
      ) : (
        <>
          {/* =================================================================== */}
          {/* PROMINENT RE-OPTIMIZE BUTTON & DISRUPTION TRIGGER CONFIG            */}
          {/* =================================================================== */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-cyan-500/40 shadow-2xl relative overflow-hidden font-mono">
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400 animate-pulse" />
              <h2 className="text-base font-bold text-white tracking-wide uppercase">
                Dynamic Network Re-Optimization Controller
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              Initiates CP-SAT mathematical optimization to detour severed links, reallocate vehicle fleets, and recalculate ETAs across the entire relief theatre.
            </p>

            {/* Quick Trigger Target Selector */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-300">
              <span className="text-slate-500 text-[11px] uppercase font-bold">Stress Trigger:</span>
              <select
                value={selectedDisruptionType}
                onChange={(e) => setSelectedDisruptionType(e.target.value)}
                disabled={isReoptimizing}
                className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="BLOCK_ROUTE">🚧 Block Route Incident</option>
                <option value="VEHICLE_FAILURE">🚚 Vehicle Breakdown</option>
                <option value="DEMAND_SURGE">📈 Demand Surge</option>
                <option value="INVENTORY_SHORTAGE">📦 Depot Shortage</option>
              </select>

              <span className="text-slate-500 text-[11px] uppercase font-bold">Target ID:</span>
              <input
                type="text"
                value={selectedTargetId}
                onChange={(e) => setSelectedTargetId(e.target.value)}
                disabled={isReoptimizing}
                className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 w-32 focus:outline-none focus:border-cyan-500"
                placeholder="e.g. ROUTE-03"
              />
            </div>
          </div>

          {/* THE PROMINENT REQUIRED BUTTON */}
          <div className="shrink-0 flex items-center">
            <button
              onClick={handleRunReoptimization}
              disabled={isReoptimizing || isOffline}
              className={`group relative px-6 py-4 rounded-xl font-mono text-sm font-bold tracking-wider transition-all duration-300 flex items-center gap-3 shadow-2xl active:scale-[0.98] ${
                isOffline
                  ? 'bg-slate-900 border-2 border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                  : isReoptimizing
                  ? 'bg-cyan-950/80 border-2 border-cyan-400 text-cyan-300 cursor-wait shadow-glow-cyan'
                  : 'bg-gradient-to-r from-cyan-600 via-cyan-500 to-emerald-500 hover:from-cyan-500 hover:to-emerald-400 text-slate-950 border-2 border-cyan-300 shadow-[0_0_25px_rgba(6,182,212,0.45)] hover:shadow-[0_0_35px_rgba(16,185,129,0.55)]'
              }`}
              title={isOffline ? 'CP-SAT re-optimization solver locked in simulated offline mode' : undefined}
            >
              <RotateCcw
                className={`w-5 h-5 ${isReoptimizing ? 'animate-spin text-cyan-300' : 'group-hover:rotate-180 transition-transform duration-500'}`}
              />
              <span className="text-base uppercase tracking-tight">
                {isOffline ? 'SOLVER LOCKED (OFFLINE)' : isReoptimizing ? 'RE-OPTIMIZING NETWORK...' : '🔄 RE-OPTIMIZE NETWORK'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-950/60 border border-rose-500/50 flex items-center justify-between font-mono text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Solver Error: {error}</span>
          </div>
          <button
            onClick={handleRunReoptimization}
            className="px-3 py-1 rounded bg-rose-900 border border-rose-500/50 text-white font-bold"
          >
            RETRY
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* REQUIRED VISUAL SEQUENCE: 5-STEP PIPELINE ANIMATION                 */}
      {/* ANALYZING DISRUPTION -> IDENTIFYING IMPACT -> RUNNING CP-SAT        */}
      {/* -> GENERATING NEW PLAN -> OPTIMIZATION COMPLETE                     */}
      {/* =================================================================== */}
      {(isReoptimizing || activeStepIndex > 0) && (
        <div className="p-5 rounded-xl bg-slate-950/90 border border-cyan-500/40 font-mono shadow-xl relative overflow-hidden backdrop-blur">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
            <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              CP-SAT SOLVER PIPELINE EXECUTION
            </span>
            <span className="text-[11px] text-cyan-400 font-bold">
              {activeStepIndex === 5 ? 'STATUS: OPTIMAL CONVERGENCE' : 'SOLVER RUNNING...'}
            </span>
          </div>

          <div className="mt-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            {STEP_LABELS.map((label, idx) => {
              const stepNum = idx + 1;
              const isPast = activeStepIndex > stepNum;
              const isCurrent = activeStepIndex === stepNum;
              const isPending = activeStepIndex < stepNum;

              return (
                <React.Fragment key={label}>
                  <div
                    className={`flex-1 w-full p-3 rounded-lg border transition-all duration-300 flex items-center gap-2.5 ${
                      isCurrent
                        ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-glow-cyan animate-pulse'
                        : isPast
                        ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                        : 'bg-slate-900/40 border-slate-800 text-slate-500'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                        isPast
                          ? 'bg-emerald-500 text-slate-950'
                          : isCurrent
                          ? 'bg-cyan-400 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isPast ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : stepNum}
                    </div>

                    <div className="min-w-0">
                      <div className="font-bold tracking-tight text-[11px] truncate uppercase">
                        {label}
                      </div>
                      <div className="text-[9px] text-slate-400">
                        {isPast ? 'COMPLETED' : isCurrent ? 'EXECUTING...' : 'PENDING'}
                      </div>
                    </div>
                  </div>

                  {idx < STEP_LABELS.length - 1 && (
                    <div className="hidden md:flex text-slate-600 font-bold text-xs shrink-0">
                      ↓
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* REQUIRED DISPLAY SECTION (WHEN RE-OPTIMIZATION IS COMPLETE)         */}
      {/* Previous ETA, New ETA, Delay, Affected Deliveries, Affected         */}
      {/* Vehicles, New Routes, Unmet Demand                                  */}
      {/* =================================================================== */}
      {reoptResult && (
        <div className="space-y-6 font-mono animate-fade-in">
          {/* 1. TOP COMPARATIVE METRICS ROW */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Previous ETA */}
            <KPICard
              title="Previous ETA"
              value={`${reoptResult.previous_eta.toFixed(1)} h`}
              unit="Baseline Total"
              statusText="PRE-DISRUPTION"
              statusVariant="neutral"
              icon={<Clock className="w-4 h-4 text-slate-400" />}
              subtext="Original scheduled arrival time"
              progress={100}
            />

            {/* New ETA */}
            <KPICard
              title="New ETA"
              value={`${reoptResult.new_eta.toFixed(1)} h`}
              unit="Re-Optimized Total"
              statusText="RECALCULATED"
              statusVariant={reoptResult.delay > 0 ? 'warning' : 'success'}
              icon={<Clock className="w-4 h-4 text-cyan-400" />}
              subtext="Computed by CP-SAT solver"
              progress={100}
            />

            {/* Delay */}
            <KPICard
              title="Schedule Delay"
              value={`${reoptResult.delay >= 0 ? '+' : ''}${reoptResult.delay.toFixed(1)} h`}
              unit="Variance"
              change={reoptResult.delay === 0 ? '0h Variance' : 'Transit Delta'}
              changeType={reoptResult.delay <= 0 ? 'positive' : 'negative'}
              statusText={reoptResult.delay === 0 ? 'ON SCHEDULE' : 'DELAY DETECTED'}
              statusVariant={reoptResult.delay <= 0 ? 'success' : 'warning'}
              icon={<TrendingDown className="w-4 h-4 text-amber-400" />}
              subtext="Net delivery timeline impact"
              progress={reoptResult.delay > 0 ? 65 : 100}
              alert={reoptResult.delay > 2}
            />

            {/* CP-SAT Solver Status */}
            <KPICard
              title="Optimization Status"
              value={reoptResult.optimization_status}
              unit="CP-SAT Solver"
              change="OR-Tools"
              statusText="SOLVED"
              statusVariant="success"
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              subtext={`Trigger: ${reoptResult.trigger}`}
              progress={100}
            />
          </div>

          {/* 2. AFFECTED ENTITIES IMPACT SUMMARY TILES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Affected Deliveries */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
                  AFFECTED DELIVERIES
                </span>
                <div className="text-2xl font-bold text-amber-400 mt-1">
                  {reoptResult.affected_deliveries.length} Shipments Impacted
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Deliveries in original plan invalidated by the disruption.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800 text-[11px] text-slate-300 flex flex-wrap gap-1">
                {reoptResult.affected_deliveries.length > 0 ? (
                  reoptResult.affected_deliveries.map((del: any) => (
                    <span
                      key={del.delivery_id || del.id || Math.random()}
                      className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-500/50 text-amber-300 font-bold"
                    >
                      {del.delivery_id || del.id || 'DELIVERY'}
                    </span>
                  ))
                ) : (
                  <span className="text-emerald-400 font-semibold">Zero shipments interrupted</span>
                )}
              </div>
            </div>

            {/* Affected Vehicles */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
                  AFFECTED VEHICLES
                </span>
                <div className="text-2xl font-bold text-rose-400 mt-1">
                  {reoptResult.affected_vehicles.length} Units Reassigned
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Vehicles disabled or reassigned to detour routes.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800 text-[11px] text-slate-300 flex flex-wrap gap-1">
                {reoptResult.affected_vehicles.length > 0 ? (
                  reoptResult.affected_vehicles.map((vId) => (
                    <span
                      key={vId}
                      className="px-1.5 py-0.5 rounded bg-rose-950/70 border border-rose-500/50 text-rose-300 font-bold"
                    >
                      {vId}
                    </span>
                  ))
                ) : (
                  <span className="text-emerald-400 font-semibold">Zero vehicles disabled</span>
                )}
              </div>
            </div>

            {/* Compromised Corridors */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
                  AFFECTED / DETOURED ROUTES
                </span>
                <div className="text-2xl font-bold text-cyan-400 mt-1">
                  {reoptResult.affected_routes.length} Corridors Rerouted
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Highways circumvented with calculated bypass paths.
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800 text-[11px] text-slate-300 flex flex-wrap gap-1">
                {reoptResult.affected_routes.length > 0 ? (
                  reoptResult.affected_routes.map((rId) => (
                    <span
                      key={rId}
                      className="px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/50 text-cyan-300 font-bold"
                    >
                      {rId}
                    </span>
                  ))
                ) : (
                  <span className="text-emerald-400 font-semibold">Standard transit maintained</span>
                )}
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* 3. UPDATED LIVE MAP DISPLAYING NEW ROUTES & HIGHLIGHTS           */}
          {/* =============================================================== */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="font-bold text-white uppercase">
                  Re-Optimized Geospatial Map // New Route & Vehicle Assignments
                </span>
              </div>

              {/* Map Legend */}
              <div className="flex items-center gap-4 text-[10px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-emerald-400 rounded-full" />
                  <span className="text-emerald-300 font-bold">New / Rerouted</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-cyan-400 rounded-full" />
                  <span>Active Routes</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-rose-500 rounded-full" />
                  <span className="text-rose-400 font-bold">Blocked Corridor</span>
                </span>
              </div>
            </div>

            <div className="h-[500px] relative">
              <LiveLogisticsMap
                state={state}
                highlightedRoutes={highlightedRoutes}
                highlightedVehicles={highlightedVehicles}
                heightClass="h-[500px]"
              />
            </div>
          </div>

          {/* =============================================================== */}
          {/* 4. NEW ROUTES & REASSIGNED DELIVERIES TABLE                      */}
          {/* =============================================================== */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-slate-200 uppercase">
                  New Plan Dispatches &amp; Vehicle Assignments ({newDeliveries.length})
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                TOTAL TRAVEL TIME: {reoptResult.new_plan?.total_eta?.toFixed(1) || reoptResult.new_eta.toFixed(1)}h
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">DELIVERY ID</th>
                    <th className="py-3 px-4">ASSIGNED VEHICLE</th>
                    <th className="py-3 px-4">ORIGIN DEPOT</th>
                    <th className="py-3 px-4">DESTINATION</th>
                    <th className="py-3 px-4">CARGO MANIFEST</th>
                    <th className="py-3 px-4">DISTANCE</th>
                    <th className="py-3 px-4 text-right">ETA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {newDeliveries.map((del: any, i: number) => {
                    const isReassignedVehicle = highlightedVehicles.includes(del.vehicle_id);

                    return (
                      <tr key={del.delivery_id || i} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-cyan-400">
                          {del.delivery_id || `DEL-${i + 1}`}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-bold ${
                              isReassignedVehicle
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500 shadow-glow-green'
                                : 'bg-slate-950 text-slate-200 border border-slate-700'
                            }`}
                          >
                            <Truck className="w-3 h-3 text-cyan-400" />
                            {del.vehicle_id}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-300">{del.depot_id || del.source_id}</td>
                        <td className="py-3 px-4 font-semibold text-white">{del.demand_point_id || del.destination_id}</td>
                        <td className="py-3 px-4">
                          <div className="text-[11px] text-slate-300">
                            {del.supplies_loaded
                              ? Object.entries(del.supplies_loaded)
                                  .filter(([_, q]) => (q as number) > 0)
                                  .map(([k, q]) => `${k}: ${q}`)
                                  .join(' | ')
                              : 'Standard Relief Payload'}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-300">
                          {del.distance?.toFixed(1) || '--'} km
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-400">
                          {del.eta?.toFixed(1) || '--'} h
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* =============================================================== */}
          {/* 5. UNMET DEMAND MATRIX BREAKDOWN                                 */}
          {/* =============================================================== */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Unmet Demand Matrix // CP-SAT Capacity Residuals
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                TOTAL DEFICIT: {reoptResult.new_plan?.total_unmet_demand?.toLocaleString() || '0'} UNITS
              </span>
            </div>

            {unmetEntries.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {unmetEntries.map(([dpId, supplies]) => (
                  <div
                    key={dpId}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                      <span className="font-bold text-white text-xs">{dpId}</span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-950/70 border border-amber-500/40 text-[9px] font-bold text-amber-300">
                        RESIDUAL DEFICIT
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      {Object.entries(supplies)
                        .filter(([_, qty]) => (qty as number) > 0)
                        .map(([st, qty]) => (
                          <div key={st} className="flex justify-between">
                            <span className="text-slate-400 uppercase text-[10px]">{st}:</span>
                            <span className="text-amber-400 font-bold">
                              {(qty as number).toLocaleString()} units
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-center text-xs text-emerald-300 font-semibold">
                ✓ CP-SAT Solver 100% satisfied all demand locations across active relief theater.
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

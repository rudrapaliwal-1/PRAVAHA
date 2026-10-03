import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldCheck,
  GitFork,
  CheckCircle2,
  Layers,
  Network,
  Truck,
  Users,
  AlertTriangle,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Activity,
  Zap,
  HelpCircle,
  Radio,
  Flame,
  ArrowRight,
  Sliders,
  Check,
} from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { StatusBadge, StatusVariant } from '../components/StatusBadge';
import { ResilienceScore, DisruptionRequest } from '../types';
import { apiService } from '../services/api';

interface ScoreHistoryItem {
  id: string;
  score: number;
  delta: number;
  trigger: string;
  timestamp: string;
}

export const ResiliencePage: React.FC = () => {
  const [resilience, setResilience] = useState<ResilienceScore | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Score history to visually demonstrate "Why did the score change?"
  const [history, setHistory] = useState<ScoreHistoryItem[]>([]);
  const previousScoreRef = useRef<number | null>(null);

  // Interactive stress test simulation state
  const [simulatingAction, setSimulatingAction] = useState<string | null>(null);
  const [simulationNotice, setSimulationNotice] = useState<string | null>(null);

  // Fetch resilience score directly from backend GET /api/resilience
  const fetchResilienceScore = useCallback(async (triggerReason: string = 'Sync') => {
    try {
      setRefreshing(true);
      setError(null);

      const data: ResilienceScore = await apiService.getResilience();
      setResilience(data);

      const currentScore = data.overall_score;
      if (previousScoreRef.current !== null && previousScoreRef.current !== currentScore) {
        const delta = Number((currentScore - previousScoreRef.current).toFixed(1));
        const newItem: ScoreHistoryItem = {
          id: `hist-${Date.now()}`,
          score: currentScore,
          delta,
          trigger: triggerReason,
          timestamp: new Date().toLocaleTimeString(),
        };
        setHistory((prev) => [newItem, ...prev.slice(0, 4)]);
      } else if (previousScoreRef.current === null) {
        // Initial entry
        setHistory([
          {
            id: `hist-${Date.now()}`,
            score: currentScore,
            delta: 0,
            trigger: 'Initial Assessment',
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      previousScoreRef.current = currentScore;
    } catch (err: any) {
      console.error('Failed to retrieve resilience score from backend:', err);
      setError(err?.message || 'Failed to connect to backend resilience engine.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchResilienceScore('Initial Load');
  }, [fetchResilienceScore]);

  // Requirement: "When a disruption happens, refresh the score. When re-optimization happens, refresh it again."
  useEffect(() => {
    const handleDisruptionEvent = () => {
      setSimulationNotice('Disruption registered across logistics network. Refreshing resilience score...');
      fetchResilienceScore('Disruption Injected');
      setTimeout(() => setSimulationNotice(null), 4000);
    };

    const handleReoptimizeEvent = () => {
      setSimulationNotice('Network re-optimization applied. Recalculating resilience score...');
      fetchResilienceScore('Network Re-Optimized');
      setTimeout(() => setSimulationNotice(null), 4000);
    };

    window.addEventListener('missionpath:disruption', handleDisruptionEvent);
    window.addEventListener('missionpath:reoptimize', handleReoptimizeEvent);

    return () => {
      window.removeEventListener('missionpath:disruption', handleDisruptionEvent);
      window.removeEventListener('missionpath:reoptimize', handleReoptimizeEvent);
    };
  }, [fetchResilienceScore]);

  // Quick Disruption Stress Tester right on the dashboard
  const handleQuickDisruption = async (type: string, targetId: string) => {
    try {
      setSimulatingAction(`Injecting ${type}...`);
      const payload: DisruptionRequest = {
        type,
        target_id: targetId,
        parameters: {},
      };
      await apiService.postDisruption(payload);
      setSimulationNotice(`Simulated ${type} on ${targetId}. Resilience degraded.`);
      await fetchResilienceScore(`Disruption (${type})`);
    } catch (err: any) {
      console.error('Simulation error:', err);
      setError(`Disruption simulation failed: ${err?.message}`);
    } finally {
      setSimulatingAction(null);
      setTimeout(() => setSimulationNotice(null), 4500);
    }
  };

  // Quick Re-Optimization Trigger right on the dashboard
  const handleQuickReoptimize = async () => {
    try {
      setSimulatingAction('Solving CP-SAT Re-Optimization...');
      await apiService.postReoptimize({
        disruption: { type: 'BLOCK_ROUTE', target_id: 'ROUTE-03' },
      });
      setSimulationNotice('CP-SAT re-optimization completed. Resilience score restored.');
      await fetchResilienceScore('CP-SAT Re-Optimization');
    } catch (err: any) {
      console.error('Re-optimization error:', err);
      setError(`Re-optimization failed: ${err?.message}`);
    } finally {
      setSimulatingAction(null);
      setTimeout(() => setSimulationNotice(null), 4500);
    }
  };

  // Extract components directly from backend response (DO NOT calculate anything in frontend)
  const overallScore = resilience ? Number(resilience.overall_score.toFixed(1)) : 82.0;
  const inventoryScore = resilience
    ? Number((resilience.inventory_score ?? resilience.inventory ?? 0).toFixed(1))
    : 80.0;
  const fleetScore = resilience
    ? Number((resilience.fleet_score ?? resilience.fleet ?? 0).toFixed(1))
    : 85.0;
  const routeScore = resilience
    ? Number((resilience.route_score ?? resilience.routes ?? 0).toFixed(1))
    : 75.0;
  const demandCoverageScore = resilience
    ? Number((resilience.demand_coverage_score ?? resilience.demand_coverage ?? 0).toFixed(1))
    : 78.0;
  const connectivityScore = resilience
    ? Number((resilience.connectivity_score ?? resilience.connectivity ?? 0).toFixed(1))
    : 84.0;
  const keyFactors = resilience?.key_factors || [];

  // Determine resilience posture status & colors based on overall score
  const getScoreHealth = (score: number) => {
    if (score >= 75) {
      return {
        label: 'OPTIMAL RESILIENCE',
        variant: 'success' as StatusVariant,
        textColor: 'text-emerald-400',
        strokeColor: '#10b981',
        bgGradient: 'from-emerald-500/20 via-slate-900 to-slate-950',
        borderColor: 'border-emerald-500/40',
        glow: 'shadow-[0_0_35px_rgba(16,185,129,0.2)]',
      };
    }
    if (score >= 55) {
      return {
        label: 'MODERATE RESILIENCE',
        variant: 'warning' as StatusVariant,
        textColor: 'text-amber-400',
        strokeColor: '#f59e0b',
        bgGradient: 'from-amber-500/20 via-slate-900 to-slate-950',
        borderColor: 'border-amber-500/40',
        glow: 'shadow-[0_0_35px_rgba(245,158,11,0.2)]',
      };
    }
    return {
      label: 'CRITICAL VULNERABILITY',
      variant: 'danger' as StatusVariant,
      textColor: 'text-rose-400',
      strokeColor: '#f43f5e',
      bgGradient: 'from-rose-500/20 via-slate-900 to-slate-950',
      borderColor: 'border-rose-500/40',
      glow: 'shadow-[0_0_35px_rgba(244,63,94,0.25)]',
    };
  };

  const health = getScoreHealth(overallScore);

  // SVG Gauge calculations
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallScore / 100) * circumference;

  // Individual Component Configurations
  const componentDimensions = [
    {
      name: 'Inventory Score',
      score: inventoryScore,
      icon: Layers,
      color: 'cyan',
      barColor: 'bg-cyan-500',
      textColor: 'text-cyan-400',
      description: 'Depot stock buffer vs regional casualty consumption burn-rate',
      status: inventoryScore >= 70 ? 'STABLE' : inventoryScore >= 50 ? 'CONSTRAINED' : 'DEFICIT',
    },
    {
      name: 'Fleet Score',
      score: fleetScore,
      icon: Truck,
      color: 'blue',
      barColor: 'bg-blue-500',
      textColor: 'text-blue-400',
      description: 'Vehicle fleet operational readiness, maintenance and fuel autonomy',
      status: fleetScore >= 75 ? 'OPTIMAL' : fleetScore >= 50 ? 'DEGRADED' : 'GROUNDED',
    },
    {
      name: 'Route Score',
      score: routeScore,
      icon: GitFork,
      color: 'indigo',
      barColor: 'bg-indigo-500',
      textColor: 'text-indigo-400',
      description: 'Navigable corridor proportion penalized by roadblocks & hazard risks',
      status: routeScore >= 70 ? 'PASSABLE' : routeScore >= 50 ? 'RESTRICTED' : 'SEVERED',
    },
    {
      name: 'Demand Coverage',
      score: demandCoverageScore,
      icon: Users,
      color: 'purple',
      barColor: 'bg-purple-500',
      textColor: 'text-purple-400',
      description: 'Fulfilled relief demands and scheduled convoy dispatches',
      status: demandCoverageScore >= 70 ? 'COVERED' : demandCoverageScore >= 50 ? 'UNMET' : 'CRITICAL',
    },
    {
      name: 'Connectivity',
      score: connectivityScore,
      icon: Network,
      color: 'emerald',
      barColor: 'bg-emerald-500',
      textColor: 'text-emerald-400',
      description: 'Graph reachability and multi-path redundancy between depots & sites',
      status: connectivityScore >= 75 ? 'MESHED' : connectivityScore >= 55 ? 'DEGRADED' : 'ISOLATED',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-mono font-semibold text-emerald-400">
              STRESS-08 // RESILIENCE
            </span>
            <span className="text-xs font-mono text-slate-500">
              ENDPOINT: GET /api/resilience (5-Dimensional Health Matrix)
            </span>
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-white mt-1">
            Supply Chain Resilience Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Holistic multi-dimensional health metrics, dynamic vulnerability attribution, and network stress endurance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge
            label={health.label}
            variant={health.variant}
            pulse={refreshing}
            size="sm"
          />
          <button
            onClick={() => fetchResilienceScore('Manual Refresh')}
            disabled={refreshing}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
            <span>{refreshing ? 'Syncing...' : 'Refresh Score'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Disruption & Re-Optimization Sandbox Bar */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Radio className="h-4 w-4 text-cyan-400 animate-pulse shrink-0" />
          <div className="text-xs">
            <span className="font-mono font-bold text-slate-200 uppercase tracking-wider block">
              Live Event Synchronization Bar
            </span>
            <span className="text-slate-400">
              Resilience updates automatically when disruptions or re-optimizations occur across the network.
            </span>
          </div>
        </div>

        {/* Quick Simulation Trigger Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleQuickDisruption('BLOCK_ROUTE', 'ROUTE-03')}
            disabled={simulatingAction !== null}
            className="px-2.5 py-1.5 rounded bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 text-xs font-mono transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Flame className="h-3 w-3 text-rose-400" />
            <span>Sim Block Route</span>
          </button>

          <button
            onClick={() => handleQuickDisruption('VEHICLE_FAILURE', 'VEH-01')}
            disabled={simulatingAction !== null}
            className="px-2.5 py-1.5 rounded bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/40 text-amber-300 text-xs font-mono transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <AlertTriangle className="h-3 w-3 text-amber-400" />
            <span>Sim Fleet Failure</span>
          </button>

          <button
            onClick={handleQuickReoptimize}
            disabled={simulatingAction !== null}
            className="px-2.5 py-1.5 rounded bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-300 text-xs font-mono transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 text-cyan-400 ${simulatingAction?.includes('CP-SAT') ? 'animate-spin' : ''}`} />
            <span>Re-Optimize</span>
          </button>
        </div>
      </div>

      {/* Simulation Feedback Alert */}
      {simulationNotice && (
        <div className="p-3 rounded-lg border border-cyan-500/40 bg-cyan-950/30 text-cyan-200 text-xs font-mono flex items-center gap-2 animate-fade-in">
          <Activity className="h-4 w-4 text-cyan-400 animate-pulse shrink-0" />
          <span>{simulationNotice}</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/20 text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchResilienceScore('Retry')}
            className="px-3 py-1.5 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-100 text-xs font-medium"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* LARGE HERO VISUAL: RESILIENCE 82 / 100 & GAUGE                      */}
      {/* =================================================================== */}
      <div className={`relative overflow-hidden rounded-2xl border ${health.borderColor} bg-gradient-to-br ${health.bgGradient} p-6 md:p-8 backdrop-blur ${health.glow} transition-all duration-500`}>
        {/* HUD Corner Tech Accents */}
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400/60 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400/60 pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Circular Radial Gauge */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center">
              <svg className="w-56 h-56 transform -rotate-90">
                {/* Background Track Ring */}
                <circle
                  cx="112"
                  cy="112"
                  r={radius}
                  stroke="#1e293b"
                  strokeWidth="14"
                  fill="transparent"
                />
                {/* Benchmark Indicator Ring (75 threshold) */}
                <circle
                  cx="112"
                  cy="112"
                  r={radius}
                  stroke="#334155"
                  strokeWidth="14"
                  strokeDasharray={`${circumference * 0.75} ${circumference}`}
                  fill="transparent"
                  className="opacity-40"
                />
                {/* Dynamic Value Ring */}
                <circle
                  cx="112"
                  cy="112"
                  r={radius}
                  stroke={health.strokeColor}
                  strokeWidth="14"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>

              {/* Centered Large Visual Text (RESILIENCE XX / 100) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
                <span className="text-[11px] font-mono tracking-widest text-slate-400 uppercase font-bold">
                  RESILIENCE
                </span>
                <div className="flex items-baseline justify-center gap-1 my-0.5">
                  <span className={`text-5xl font-mono font-extrabold tracking-tight ${health.textColor}`}>
                    {Math.round(overallScore)}
                  </span>
                  <span className="text-xl font-mono font-semibold text-slate-400">
                    / 100
                  </span>
                </div>
                <StatusBadge label={health.label} variant={health.variant} size="sm" />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-4 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-600" />
                Benchmark: 75 / 100
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: health.strokeColor }} />
                Current: {overallScore.toFixed(1)}
              </span>
            </div>
          </div>

          {/* Overall Resilience Narrative & Health Posture */}
          <div className="lg:col-span-7 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className={`h-6 w-6 ${health.textColor}`} />
                <h2 className="text-xl md:text-2xl font-bold font-mono tracking-tight text-white">
                  System-Wide Supply Chain Resilience
                </h2>
              </div>
              <p className="text-xs md:text-sm text-slate-300 leading-relaxed max-w-xl">
                Real-time composite resilience index computed from active network topology, inventory buffers across base depots, fleet operational readiness, route passability, and emergency demand coverage.
              </p>
            </div>

            {/* Assessment Meta & Score Delta */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                <span className="block text-[10px] font-mono uppercase text-slate-400">Overall Score</span>
                <span className={`text-base font-mono font-bold ${health.textColor}`}>
                  {overallScore.toFixed(1)} / 100
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                <span className="block text-[10px] font-mono uppercase text-slate-400">Posture Status</span>
                <span className="text-xs font-mono font-semibold text-slate-200 block truncate">
                  {health.label}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 col-span-2 sm:col-span-1">
                <span className="block text-[10px] font-mono uppercase text-slate-400">Calculated At</span>
                <span className="text-xs font-mono text-slate-300">
                  {resilience?.calculated_at ? new Date(resilience.calculated_at).toLocaleTimeString() : 'Live'}
                </span>
              </div>
            </div>

            {/* Score Delta History Trail */}
            {history.length > 1 && (
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs font-mono">
                <span className="text-[11px] text-slate-400 block mb-1 font-semibold uppercase tracking-wider">
                  Recent Variance Progression:
                </span>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  {history.map((h, i) => (
                    <div key={h.id} className="flex items-center gap-1.5">
                      <span className="text-slate-300 font-bold">{h.score.toFixed(1)}</span>
                      {h.delta !== 0 && (
                        <span className={`flex items-center text-[10px] font-semibold ${h.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {h.delta > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                          {h.delta > 0 ? `+${h.delta}` : h.delta}
                        </span>
                      )}
                      <span className="text-slate-500">({h.trigger})</span>
                      {i < history.length - 1 && <ArrowRight className="h-3 w-3 text-slate-600 mx-1" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 5 INDIVIDUAL COMPONENT SCORES & PROGRESS INDICATORS                  */}
      {/* =================================================================== */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 backdrop-blur space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold font-mono text-slate-100 uppercase tracking-wide flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              Component Vectors Breakdown
            </h3>
            <p className="text-xs text-slate-400">
              Five core dimensions evaluated independently by the backend resilience algorithm.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            NORMALIZED BENCHMARK: 0 - 100
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {componentDimensions.map((comp) => {
            const Icon = comp.icon;
            return (
              <div
                key={comp.name}
                className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Icon className={`h-4 w-4 ${comp.textColor}`} />
                      <span className="text-xs font-mono font-bold text-slate-200">
                        {comp.name}
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-700 ${comp.textColor}`}>
                      {comp.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {comp.description}
                  </p>
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className="flex items-baseline justify-between font-mono">
                    <span className="text-xs text-slate-500 uppercase">Score:</span>
                    <span className={`text-lg font-extrabold ${comp.textColor}`}>
                      {comp.score.toFixed(1)}
                      <span className="text-xs text-slate-500 font-normal"> / 100</span>
                    </span>
                  </div>

                  {/* Progress Indicator Bar */}
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${comp.barColor} rounded-full transition-all duration-700 ease-out`}
                      style={{ width: `${Math.min(100, Math.max(0, comp.score))}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =================================================================== */}
      {/* "WHY DID THE SCORE CHANGE?" KEY FACTORS SECTION                     */}
      {/* =================================================================== */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 backdrop-blur space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold font-mono text-slate-100 uppercase tracking-wide flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-cyan-400" />
              Why Did The Score Change?
            </h3>
            <p className="text-xs text-slate-400">
              Qualitative attribution factors and critical vulnerabilities returned directly by Person 1's backend engine.
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-1 rounded">
            {keyFactors.length} Critical Attribution Drivers
          </span>
        </div>

        {/* Factors List */}
        {keyFactors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {keyFactors.map((factor, index) => {
              // Analyze qualitative tone to assign appropriate iconography & badge
              const lower = factor.toLowerCase();
              const isPositive =
                lower.includes('optimal') ||
                lower.includes('sufficient') ||
                lower.includes('readiness optimal') ||
                lower.includes('recovered') ||
                lower.includes('intact');
              const isNegative =
                lower.includes('decreased') ||
                lower.includes('blockage') ||
                lower.includes('high risk') ||
                lower.includes('constrained') ||
                lower.includes('degraded') ||
                lower.includes('isolated') ||
                lower.includes('deficit');

              return (
                <div
                  key={index}
                  className={`p-4 rounded-xl border flex items-start gap-3 transition ${
                    isPositive
                      ? 'border-emerald-500/30 bg-emerald-950/20'
                      : isNegative
                      ? 'border-amber-500/30 bg-amber-950/20'
                      : 'border-slate-800 bg-slate-950/60'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {isPositive ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    ) : isNegative ? (
                      <AlertTriangle className="h-5 w-5 text-amber-400" />
                    ) : (
                      <Activity className="h-5 w-5 text-cyan-400" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-400">
                        Factor #{index + 1}
                      </span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded uppercase font-bold ${
                          isPositive
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                            : isNegative
                            ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {isPositive ? 'STABILIZER' : isNegative ? 'DEGRADATION DRIVER' : 'OBSERVATION'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 font-medium leading-relaxed">
                      {factor}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-slate-500 text-xs font-mono">
            No factor anomalies reported. Network posture operating within nominal tolerance.
          </div>
        )}
      </div>
    </div>
  );
};

export default ResiliencePage;

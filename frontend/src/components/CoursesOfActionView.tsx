import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  ShieldCheck,
  Fuel,
  Clock,
  Navigation,
  AlertTriangle,
  DollarSign,
  PackageX,
  Truck,
  Eye,
  CheckCircle2,
  RefreshCw,
  X,
  ChevronRight,
  Info,
  MapPin,
  Calendar,
  Layers,
  ArrowUpRight,
  SlidersHorizontal,
  Flame,
  Check,
  XCircle,
} from 'lucide-react';
import { KPICard } from './KPICard';
import { StatusBadge, StatusVariant } from './StatusBadge';
import { LiveLogisticsMap } from './LiveLogisticsMap';
import {
  CourseOfActionPlan,
  CoursesOfActionResponse,
  OptimizationDelivery,
  PlanDecisionResponse,
  LogisticsState,
} from '../types';
import { apiService } from '../services/api';
import { useConnectivity } from '../context/ConnectivityContext';

interface CoursesOfActionViewProps {
  onPlanApproved?: (plan: CourseOfActionPlan) => void;
}

export const CoursesOfActionView: React.FC<CoursesOfActionViewProps> = ({
  onPlanApproved,
}) => {
  const { isOffline } = useConnectivity();
  const [plans, setPlans] = useState<CourseOfActionPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  // Operator-selected approved plan (strictly null initially — NO automated selection!)
  const [approvedPlanId, setApprovedPlanId] = useState<string | null>(null);
  const [approvedPlanDetails, setApprovedPlanDetails] = useState<PlanDecisionResponse | null>(null);

  // Plan modal inspection state
  const [inspectingPlan, setInspectingPlan] = useState<CourseOfActionPlan | null>(null);

  // Approval & Rejection in progress state
  const [approvingPlanId, setApprovingPlanId] = useState<string | null>(null);
  const [rejectingPlanId, setRejectingPlanId] = useState<string | null>(null);
  const [approvalFeedback, setApprovalFeedback] = useState<{
    planId: string;
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // World state for map overlay
  const [worldState, setWorldState] = useState<LogisticsState | null>(null);

  // Load COA plans from backend
  const fetchCoursesOfAction = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setApprovalFeedback(null);

      // Fetch COAs, world state, and registered backend plans concurrently
      const [coaResponse, stateResponse, registeredPlans] = await Promise.all([
        apiService.postCoursesOfAction({}),
        apiService.getLogisticsState().catch(() => null),
        apiService.getPlans().catch(() => []),
      ]);

      const candidatePlans = coaResponse.plans || coaResponse.coas || [];
      const updatedPlans = candidatePlans.map((cp: CourseOfActionPlan) => {
        const found = (registeredPlans || []).find((rp: any) => rp.id === cp.id || rp.name === cp.name);
        return found ? { ...cp, id: found.id, status: found.status } : cp;
      });

      setPlans(updatedPlans);
      setGeneratedAt(coaResponse.generated_at || new Date().toISOString());
      if (stateResponse) {
        setWorldState(stateResponse);
      }

      // Check if any plan is already approved on backend (never auto-approve in frontend)
      const alreadyApproved = updatedPlans.find((p: CourseOfActionPlan) => p.status === 'APPROVED');
      if (alreadyApproved) {
        setApprovedPlanId(alreadyApproved.id);
      }
    } catch (err: any) {
      console.error('Failed to generate Courses of Action:', err);
      setError(err?.message || 'Failed to generate Courses of Action from optimizer service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoursesOfAction();
  }, [fetchCoursesOfAction]);

  // Synchronize with external plan decision events (e.g. from Dashboard or other views)
  useEffect(() => {
    const handleDecisionEvent = (e: any) => {
      const detail = e.detail;
      if (!detail || !detail.plan_id) return;
      setPlans((prev) =>
        prev.map((p) => {
          if (p.id === detail.plan_id) {
            return { ...p, status: detail.status };
          }
          if (detail.status === 'APPROVED' && p.status === 'APPROVED') {
            return { ...p, status: 'PENDING' };
          }
          return p;
        })
      );
      if (detail.status === 'APPROVED') {
        setApprovedPlanId(detail.plan_id);
      } else if (detail.status === 'REJECTED') {
        setApprovedPlanId((prev) => (prev === detail.plan_id ? null : prev));
      }
    };
    window.addEventListener('missionpath:plan_decision', handleDecisionEvent);
    return () => window.removeEventListener('missionpath:plan_decision', handleDecisionEvent);
  }, []);

  // Handle plan approval (Explicit Human Operator Choice)
  const handleApprovePlan = async (plan: CourseOfActionPlan) => {
    try {
      setApprovingPlanId(plan.id);
      setApprovalFeedback(null);

      const response = await apiService.postApprovePlan(
        plan.id,
        `Authorized by Mission Logistics Commander for immediate execution.`
      );

      setApprovedPlanId(plan.id);
      setApprovedPlanDetails(response);
      setApprovalFeedback({
        planId: plan.id,
        message: `Plan ${plan.id} (${plan.name}) successfully authorized and activated in the field.`,
        type: 'success',
      });

      // Update the local plan status
      setPlans((prev) =>
        prev.map((p) => ({
          ...p,
          status: p.id === plan.id ? 'APPROVED' : p.status === 'APPROVED' ? 'PENDING' : p.status,
        }))
      );

      if (onPlanApproved) {
        onPlanApproved(plan);
      }

      window.dispatchEvent(
        new CustomEvent('missionpath:plan_decision', {
          detail: {
            plan_id: plan.id,
            status: 'APPROVED',
            message: response.message,
            plan: response.plan,
          },
        })
      );

      window.dispatchEvent(new CustomEvent('missionpath:reoptimize', { detail: plan }));
    } catch (err: any) {
      console.error('Failed to approve plan:', err);
      setApprovalFeedback({
        planId: plan.id,
        message: err?.message || 'Error occurred while approving plan with backend.',
        type: 'error',
      });
    } finally {
      setApprovingPlanId(null);
    }
  };

  // Handle plan rejection (Explicit Human Operator Choice)
  const handleRejectPlan = async (plan: CourseOfActionPlan) => {
    try {
      setRejectingPlanId(plan.id);
      setApprovalFeedback(null);

      const response = await apiService.postRejectPlan(
        plan.id,
        `Rejected by Mission Logistics Commander upon review.`
      );

      if (approvedPlanId === plan.id) {
        setApprovedPlanId(null);
        setApprovedPlanDetails(null);
      }

      setApprovalFeedback({
        planId: plan.id,
        message: `Plan ${plan.id} (${plan.name}) rejected by operator.`,
        type: 'error',
      });

      // Update the local plan status to REJECTED
      setPlans((prev) =>
        prev.map((p) => ({
          ...p,
          status: p.id === plan.id ? 'REJECTED' : p.status,
        }))
      );

      window.dispatchEvent(
        new CustomEvent('missionpath:plan_decision', {
          detail: {
            plan_id: plan.id,
            status: 'REJECTED',
            message: response.message,
            plan: response.plan,
          },
        })
      );
    } catch (err: any) {
      console.error('Failed to reject plan:', err);
      setApprovalFeedback({
        planId: plan.id,
        message: err?.message || 'Error occurred while rejecting plan with backend.',
        type: 'error',
      });
    } finally {
      setRejectingPlanId(null);
    }
  };

  // Format Risk score into standard Low / Medium / High
  const formatRisk = (riskScore: number): { label: string; variant: StatusVariant; percent: string } => {
    const percent = `${Math.round(riskScore * 100)}%`;
    if (riskScore <= 0.35) {
      return { label: 'Low', variant: 'success', percent };
    }
    if (riskScore <= 0.65) {
      return { label: 'Medium', variant: 'warning', percent };
    }
    return { label: 'High', variant: 'danger', percent };
  };

  // Format ETA to minutes (and hours if > 1h)
  const formatETA = (etaHours: number): string => {
    const totalMinutes = Math.round(etaHours * 60);
    if (totalMinutes < 60) {
      return `${totalMinutes} min`;
    }
    const hours = (totalMinutes / 60).toFixed(1);
    return `${totalMinutes} min (${hours}h)`;
  };

  // Visual styling config for the 3 distinct COA strategies
  const getStrategyConfig = (name: string) => {
    const upper = name.toUpperCase();
    if (upper.includes('FAST') || upper === 'FASTEST') {
      return {
        title: 'FASTEST',
        tagline: 'Minimizes response time & critical triage latency',
        icon: Zap,
        color: 'cyan',
        border: 'border-cyan-500/40 hover:border-cyan-400',
        badgeBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
        glow: 'shadow-[0_0_20px_rgba(6,182,212,0.15)]',
        accentBg: 'from-cyan-950/40 via-slate-900/60 to-slate-950/80',
        buttonClass: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/40',
      };
    }
    if (upper.includes('RISK') || upper === 'LOWEST_RISK') {
      return {
        title: 'LOWEST RISK',
        tagline: 'Maximizes convoy survivability & safe corridors',
        icon: ShieldCheck,
        color: 'emerald',
        border: 'border-emerald-500/40 hover:border-emerald-400',
        badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
        accentBg: 'from-emerald-950/40 via-slate-900/60 to-slate-950/80',
        buttonClass: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40',
      };
    }
    // RESOURCE_EFFICIENT
    return {
      title: 'RESOURCE EFFICIENT',
      tagline: 'Minimizes fuel consumption & vehicle wear',
      icon: Fuel,
      color: 'purple',
      border: 'border-purple-500/40 hover:border-purple-400',
      badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      glow: 'shadow-[0_0_20px_rgba(168,85,247,0.15)]',
      accentBg: 'from-purple-950/40 via-slate-900/60 to-slate-950/80',
      buttonClass: 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/40',
    };
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Decision Requirement Notice */}
      <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 p-5 md:p-6 backdrop-blur">
        <div className="absolute top-0 right-0 h-40 w-96 bg-gradient-to-bl from-blue-600/10 via-purple-600/5 to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-mono uppercase tracking-widest text-cyan-400">
                Multi-Plan Decision Support System
              </span>
              <span className="text-xs text-slate-500">|</span>
              <span className="text-xs font-mono text-slate-400">
                Generated: {generatedAt ? new Date(generatedAt).toLocaleTimeString() : 'Synchronizing...'}
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <SlidersHorizontal className="h-6 w-6 text-cyan-400" />
              Courses of Action (COA) Candidates
            </h2>
            <p className="text-sm text-slate-400 max-w-3xl">
              Three distinct feasible optimization plans computed via Google OR-Tools CP-SAT. Evaluates strategic trade-offs across response speed, convoy security, and logistics resource conservation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchCoursesOfAction}
              disabled={loading}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-sm font-medium transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
              <span>{loading ? 'Solving Candidates...' : 'Regenerate COAs'}</span>
            </button>
          </div>
        </div>

        {/* Human-in-the-loop Directive Box */}
        <div className="mt-5 p-3.5 rounded-lg border border-amber-500/30 bg-amber-950/20 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-amber-300 uppercase tracking-wider font-mono">
              Operational Directive: Mandatory Human Selection
            </p>
            <p className="text-slate-300">
              Autonomous execution is <span className="text-amber-200 font-semibold">strictly prohibited</span>. A designated human logistics commander must inspect the trade-offs and authorize the operational plan before vehicle dispatch coordinates are broadcast.
            </p>
          </div>
          <div className="ml-auto shrink-0 self-center">
            {approvedPlanId ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <CheckCircle2 className="h-3.5 w-3.5" />
                ACTIVE PLAN: {approvedPlanId}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-amber-500/20 text-amber-400 border border-amber-500/40">
                <Clock className="h-3.5 w-3.5 animate-spin" />
                AWAITING SELECTION
              </span>
            )}
          </div>
        </div>

        {/* Feedback alert after approval action */}
        {approvalFeedback && (
          <div
            className={`mt-3 p-3 rounded-lg border text-xs flex items-center justify-between ${
              approvalFeedback.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                : 'border-rose-500/40 bg-rose-950/30 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {approvalFeedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              )}
              <span>{approvalFeedback.message}</span>
            </div>
            <button
              onClick={() => setApprovalFeedback(null)}
              className="text-slate-400 hover:text-white ml-2"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Loading state skeleton */}
      {loading && plans.length === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 animate-pulse space-y-4"
            >
              <div className="h-6 w-32 bg-slate-800 rounded" />
              <div className="h-4 w-48 bg-slate-800 rounded" />
              <div className="space-y-3 pt-4 border-t border-slate-800/80">
                <div className="h-4 w-full bg-slate-800 rounded" />
                <div className="h-4 w-full bg-slate-800 rounded" />
                <div className="h-4 w-full bg-slate-800 rounded" />
              </div>
              <div className="h-10 w-full bg-slate-800 rounded mt-6" />
            </div>
          ))}
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
            onClick={fetchCoursesOfAction}
            className="px-3 py-1.5 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-100 text-xs font-medium"
          >
            Retry Solver
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && plans.length === 0 && !error && (
        <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/40 text-center font-mono text-sm text-slate-400 space-y-3">
          <SlidersHorizontal className="h-8 w-8 text-slate-600 mx-auto" />
          <p className="font-semibold text-slate-300">No Courses of Action Candidate Plans Available</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            The CP-SAT optimizer has not generated candidate plans yet. Click below to compute three feasible Courses of Action.
          </p>
          <button
            onClick={fetchCoursesOfAction}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs"
          >
            Generate Courses of Action
          </button>
        </div>
      )}

      {/* THREE PLAN CARDS: FASTEST | LOWEST RISK | RESOURCE EFFICIENT */}
      {!loading && plans.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const config = getStrategyConfig(plan.name);
            const riskInfo = formatRisk(plan.risk);
            const isApproved = approvedPlanId === plan.id || plan.status === 'APPROVED';
            const isRejected = plan.status === 'REJECTED';
            const isApproving = approvingPlanId === plan.id;
            const isRejecting = rejectingPlanId === plan.id;
            const Icon = config.icon;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-xl border transition-all duration-300 bg-gradient-to-b ${config.accentBg} ${
                  isApproved
                    ? 'border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]'
                    : isRejected
                    ? 'border-rose-900/60 opacity-80'
                    : config.border
                } ${config.glow} p-5 md:p-6`}
              >
                {/* Active Approved Plan Ribbon */}
                {isApproved && (
                  <div className="absolute -top-3.5 right-6 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-950/60">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    ✓ PLAN APPROVED
                  </div>
                )}

                {/* Rejected Plan Ribbon */}
                {isRejected && !isApproved && (
                  <div className="absolute -top-3.5 right-6 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-900 text-rose-200 border border-rose-500/40 shadow-lg">
                    <XCircle className="h-3.5 w-3.5" />
                    PLAN REJECTED
                  </div>
                )}

                {/* Card Header: Strategy Title & Icon */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${config.badgeBg}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {config.title}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {plan.id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-snug">
                      {plan.description || config.tagline}
                    </p>
                  </div>

                  <div className={`p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-${config.color}-400 shrink-0`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>

                {/* Approval Status Indicator: PENDING / ✓ PLAN APPROVED / PLAN REJECTED */}
                <div className="mb-4 flex items-center justify-between text-xs font-mono py-1.5 px-3 rounded bg-slate-950/60 border border-slate-800">
                  <span className="text-slate-400">Status:</span>
                  {isApproved ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>✓ PLAN APPROVED</span>
                    </span>
                  ) : isRejected ? (
                    <span className="inline-flex items-center gap-1 font-bold text-rose-400">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>PLAN REJECTED</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-bold text-amber-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>PENDING</span>
                    </span>
                  )}
                </div>

                {/* Metrics Grid (ETA, Distance, Risk, Cost, Unmet Demand, Number of Deliveries) */}
                <div className="space-y-2.5 flex-1 pt-1">
                  {/* ETA */}
                  <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800/60">
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                      <Clock className="h-3.5 w-3.5 text-cyan-400" />
                      <span>ETA</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-slate-100">
                      {formatETA(plan.eta)}
                    </span>
                  </div>

                  {/* Distance */}
                  <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800/60">
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                      <Navigation className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Distance</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-slate-100">
                      {plan.distance.toFixed(1)} km
                    </span>
                  </div>

                  {/* Risk */}
                  <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800/60">
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Risk</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        label={riskInfo.label}
                        variant={riskInfo.variant}
                        size="sm"
                      />
                      <span className="text-xs font-mono text-slate-400">
                        {riskInfo.percent}
                      </span>
                    </div>
                  </div>

                  {/* Cost */}
                  <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800/60">
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                      <DollarSign className="h-3.5 w-3.5 text-amber-400" />
                      <span>Cost</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-slate-100">
                      {Math.round(plan.cost).toLocaleString()}
                    </span>
                  </div>

                  {/* Unmet Demand */}
                  <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800/60">
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                      <PackageX className="h-3.5 w-3.5 text-rose-400" />
                      <span>Unmet Demand</span>
                    </div>
                    <span className={`text-sm font-mono font-bold ${plan.unmet_demand > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {plan.unmet_demand === 0 ? '0 units (0%)' : `${Math.round(plan.unmet_demand).toLocaleString()} units`}
                    </span>
                  </div>

                  {/* Number of Deliveries */}
                  <div className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800/60">
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                      <Truck className="h-3.5 w-3.5 text-blue-400" />
                      <span>Number of Deliveries</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-slate-100">
                      {plan.deliveries?.length || 0} Deliveries
                    </span>
                  </div>
                </div>

                {/* Action Buttons: [ APPROVE ], [ REJECT ], [ VIEW PLAN ] */}
                <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* [ APPROVE ] */}
                    <button
                      onClick={() => handleApprovePlan(plan)}
                      disabled={isApproved || isApproving || isRejecting || isOffline}
                      className={`inline-flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition shadow-md ${
                        isApproved
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 cursor-default'
                          : isOffline
                          ? 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60 active:scale-[0.98]'
                      }`}
                      title={isOffline ? 'Plan authorization locked while simulating offline mode' : undefined}
                    >
                      {isApproving ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Authorizing...</span>
                        </>
                      ) : isApproved ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>✓ PLAN APPROVED</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>APPROVE</span>
                        </>
                      )}
                    </button>

                    {/* [ REJECT ] */}
                    <button
                      onClick={() => handleRejectPlan(plan)}
                      disabled={isRejected || isApproving || isRejecting || isOffline}
                      className={`inline-flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition shadow-md ${
                        isRejected
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 cursor-default'
                          : isOffline
                          ? 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                          : 'bg-slate-900 border border-rose-500/40 text-rose-400 hover:bg-rose-950/40 hover:border-rose-400 active:scale-[0.98]'
                      }`}
                      title={isOffline ? 'Plan rejection locked while simulating offline mode' : undefined}
                    >
                      {isRejecting ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          <span>Rejecting...</span>
                        </>
                      ) : isRejected ? (
                        <>
                          <XCircle className="h-3.5 w-3.5 text-rose-400" />
                          <span>PLAN REJECTED</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3.5 w-3.5" />
                          <span>REJECT</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* [ VIEW PLAN ] */}
                  <button
                    onClick={() => setInspectingPlan(plan)}
                    className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 hover:text-white text-slate-300 text-xs font-medium font-mono uppercase tracking-wider transition shadow-sm"
                  >
                    <Eye className="h-3.5 w-3.5 text-cyan-400" />
                    <span>View Plan Deliveries</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Side-by-Side Trade-Off Comparison Matrix */}
      {!loading && plans.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 md:p-6 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-0.5">
              <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-400" />
                Strategic Trade-Off Evaluation Matrix
              </h3>
              <p className="text-xs text-slate-400">
                Direct side-by-side comparative analysis of the three computed Courses of Action.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono">
                  <th className="py-2.5 px-3 font-semibold">Evaluation Metric</th>
                  {plans.map((p) => (
                    <th key={p.id} className="py-2.5 px-4 font-semibold">
                      <span className="text-slate-200">{p.name}</span>
                      <span className="block text-[10px] text-slate-500 font-normal">{p.id}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
                <tr>
                  <td className="py-2.5 px-3 text-slate-400 flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-cyan-400" />
                    ETA (Transit Duration)
                  </td>
                  {plans.map((p) => (
                    <td key={p.id} className="py-2.5 px-4 font-bold text-slate-100">
                      {formatETA(p.eta)}
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="py-2.5 px-3 text-slate-400 flex items-center gap-1.5">
                    <Navigation className="h-3 w-3 text-indigo-400" />
                    Total Distance
                  </td>
                  {plans.map((p) => (
                    <td key={p.id} className="py-2.5 px-4 font-bold text-slate-100">
                      {p.distance.toFixed(1)} km
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="py-2.5 px-3 text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3 text-emerald-400" />
                    Convoy Threat / Risk
                  </td>
                  {plans.map((p) => {
                    const r = formatRisk(p.risk);
                    return (
                      <td key={p.id} className="py-2.5 px-4">
                        <StatusBadge label={`${r.label} (${r.percent})`} variant={r.variant} size="sm" />
                      </td>
                    );
                  })}
                </tr>

                <tr>
                  <td className="py-2.5 px-3 text-slate-400 flex items-center gap-1.5">
                    <DollarSign className="h-3 w-3 text-amber-400" />
                    Operational Cost
                  </td>
                  {plans.map((p) => (
                    <td key={p.id} className="py-2.5 px-4 font-bold text-slate-100">
                      {Math.round(p.cost).toLocaleString()}
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="py-2.5 px-3 text-slate-400 flex items-center gap-1.5">
                    <PackageX className="h-3 w-3 text-rose-400" />
                    Unmet Demand
                  </td>
                  {plans.map((p) => (
                    <td key={p.id} className={`py-2.5 px-4 font-bold ${p.unmet_demand > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {Math.round(p.unmet_demand).toLocaleString()} units
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="py-2.5 px-3 text-slate-400 flex items-center gap-1.5">
                    <Truck className="h-3 w-3 text-blue-400" />
                    Scheduled Deliveries
                  </td>
                  {plans.map((p) => (
                    <td key={p.id} className="py-2.5 px-4 text-slate-200">
                      {p.deliveries?.length || 0} Dispatches
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="py-2.5 px-3 text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    Authorization Status
                  </td>
                  {plans.map((p) => {
                    const isApproved = approvedPlanId === p.id;
                    return (
                      <td key={p.id} className="py-2.5 px-4">
                        {isApproved ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <Check className="h-3 w-3" /> ACTIVE
                          </span>
                        ) : (
                          <span className="text-slate-500 font-normal">Candidate</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PLAN INSPECTION MODAL (When operator clicks [ VIEW PLAN ]) */}
      {inspectingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 md:p-6 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    {inspectingPlan.name}
                  </span>
                  <span className="text-xs font-mono text-slate-400">ID: {inspectingPlan.id}</span>
                  {approvedPlanId === inspectingPlan.id && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      AUTHORIZED
                    </span>
                  )}
                </div>
                <h3 className="text-lg md:text-xl font-bold text-white">
                  Course of Action Detailed Dispatch Manifest
                </h3>
              </div>

              <button
                onClick={() => setInspectingPlan(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">
              {/* Executive Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="block text-[10px] font-mono uppercase text-slate-500">ETA</span>
                  <span className="text-sm font-mono font-bold text-cyan-400">
                    {formatETA(inspectingPlan.eta)}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="block text-[10px] font-mono uppercase text-slate-500">Distance</span>
                  <span className="text-sm font-mono font-bold text-indigo-400">
                    {inspectingPlan.distance.toFixed(1)} km
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="block text-[10px] font-mono uppercase text-slate-500">Convoy Risk</span>
                  <span className="text-sm font-mono font-bold text-emerald-400">
                    {formatRisk(inspectingPlan.risk).label}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="block text-[10px] font-mono uppercase text-slate-500">Cost</span>
                  <span className="text-sm font-mono font-bold text-amber-400">
                    {Math.round(inspectingPlan.cost).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="block text-[10px] font-mono uppercase text-slate-500">Unmet Demand</span>
                  <span className="text-sm font-mono font-bold text-rose-400">
                    {Math.round(inspectingPlan.unmet_demand).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="block text-[10px] font-mono uppercase text-slate-500">Deliveries</span>
                  <span className="text-sm font-mono font-bold text-blue-400">
                    {inspectingPlan.deliveries?.length || 0} Dispatches
                  </span>
                </div>
              </div>

              {/* Rationale explanation */}
              {inspectingPlan.description && (
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60">
                  <div className="flex items-center gap-2 mb-1 text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                    <Info className="h-4 w-4" />
                    Strategic Rationale & Solver Policy
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {inspectingPlan.description}
                  </p>
                </div>
              )}

              {/* Map Preview for this specific plan */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-cyan-400" />
                    Tactical Network Route Preview
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    Highlighting {inspectingPlan.deliveries?.map(d => d.route_id).filter(Boolean).length} route segments
                  </span>
                </div>
                <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
                  <LiveLogisticsMap
                    state={worldState}
                    heightClass="h-[320px]"
                    highlightedRoutes={inspectingPlan.deliveries?.map((d) => d.route_id).filter(Boolean)}
                    highlightedVehicles={inspectingPlan.deliveries?.map((d) => d.vehicle_id).filter(Boolean)}
                  />
                </div>
              </div>

              {/* Deliveries Schedule Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Truck className="h-4 w-4 text-cyan-400" />
                  Assigned Deliveries Schedule ({inspectingPlan.deliveries?.length || 0})
                </h4>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-mono bg-slate-900/60">
                        <th className="py-2.5 px-3 font-semibold">Vehicle</th>
                        <th className="py-2.5 px-3 font-semibold">Origin Depot</th>
                        <th className="py-2.5 px-3 font-semibold">Destination Site</th>
                        <th className="py-2.5 px-3 font-semibold">Cargo Payload</th>
                        <th className="py-2.5 px-3 font-semibold">Route</th>
                        <th className="py-2.5 px-3 font-semibold">Distance</th>
                        <th className="py-2.5 px-3 font-semibold">Risk</th>
                        <th className="py-2.5 px-3 font-semibold">ETA</th>
                        <th className="py-2.5 px-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
                      {inspectingPlan.deliveries && inspectingPlan.deliveries.length > 0 ? (
                        inspectingPlan.deliveries.map((del, i) => (
                          <tr key={i} className="hover:bg-slate-900/40">
                            <td className="py-2.5 px-3 font-bold text-cyan-400">
                              {del.vehicle_id}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">
                              {del.depot_id}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-100">
                              {del.demand_point_id}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="capitalize text-slate-200">{del.supply_type}</span>{' '}
                              <span className="text-slate-400">({del.quantity.toLocaleString()} kg)</span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400">
                              {del.route_id}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">
                              {del.distance.toFixed(1)} km
                            </td>
                            <td className="py-2.5 px-3">
                              <StatusBadge
                                label={del.risk || 'Normal'}
                                variant={
                                  del.risk === 'low'
                                    ? 'success'
                                    : del.risk === 'high'
                                    ? 'danger'
                                    : 'warning'
                                }
                                size="sm"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">
                              {del.eta.toFixed(1)}h
                            </td>
                            <td className="py-2.5 px-3">
                              {del.late_delivery ? (
                                <span className="text-amber-400 text-[10px] font-bold">LATE RISK</span>
                              ) : (
                                <span className="text-emerald-400 text-[10px] font-bold">ON TIME</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9} className="py-6 text-center text-slate-500">
                            No delivery details available for this plan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 md:p-5 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-4">
              <span className="text-xs text-slate-400 font-mono">
                Candidate Plan ID: <span className="text-slate-200">{inspectingPlan.id}</span>
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setInspectingPlan(null)}
                  className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium font-mono uppercase tracking-wider transition"
                >
                  Close
                </button>

                <button
                  onClick={() => {
                    handleRejectPlan(inspectingPlan);
                    setInspectingPlan(null);
                  }}
                  disabled={inspectingPlan.status === 'REJECTED' || rejectingPlanId === inspectingPlan.id || isOffline}
                  className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition border ${
                    isOffline
                      ? 'border-slate-800 bg-slate-900 text-slate-500 cursor-not-allowed opacity-60'
                      : 'border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300'
                  }`}
                  title={isOffline ? 'Disabled in simulated offline mode' : undefined}
                >
                  <XCircle className="h-4 w-4" />
                  <span>
                    {inspectingPlan.status === 'REJECTED' ? 'PLAN REJECTED' : 'REJECT'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    handleApprovePlan(inspectingPlan);
                    setInspectingPlan(null);
                  }}
                  disabled={approvedPlanId === inspectingPlan.id || approvingPlanId === inspectingPlan.id || isOffline}
                  className={`inline-flex items-center space-x-1.5 px-5 py-2 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition shadow-md ${
                    approvedPlanId === inspectingPlan.id
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                      : isOffline
                      ? 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60'
                  }`}
                  title={isOffline ? 'Disabled in simulated offline mode' : undefined}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {approvedPlanId === inspectingPlan.id ? '✓ PLAN APPROVED' : 'APPROVE'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

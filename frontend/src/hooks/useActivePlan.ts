import { useState, useEffect, useCallback } from 'react';
import { CourseOfActionPlan, PlanDecisionResponse } from '../types';
import { apiService } from '../services/api';

export interface ActivePlanState {
  plans: CourseOfActionPlan[];
  activePlan: CourseOfActionPlan | null;
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  lastDecision: PlanDecisionResponse | null;
  approvePlan: (planId: string, reason?: string) => Promise<PlanDecisionResponse>;
  rejectPlan: (planId: string, reason?: string) => Promise<PlanDecisionResponse>;
  refreshPlans: () => Promise<void>;
}

export const useActivePlan = (): ActivePlanState => {
  const [plans, setPlans] = useState<CourseOfActionPlan[]>([]);
  const [activePlan, setActivePlan] = useState<CourseOfActionPlan | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDecision, setLastDecision] = useState<PlanDecisionResponse | null>(null);

  const refreshPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Query registered plans from GET /api/plans
      let registered = await apiService.getPlans().catch(() => []);

      // If no plans are registered in backend memory, generate the 3 candidate COAs
      if (!registered || registered.length === 0) {
        const coaResp = await apiService.postCoursesOfAction({}).catch(() => null);
        if (coaResp && (coaResp.plans || coaResp.coas)) {
          registered = coaResp.plans || coaResp.coas || [];
        }
      }

      const formattedPlans: CourseOfActionPlan[] = (registered || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        eta: p.eta ?? p.total_eta ?? 0,
        distance: p.distance ?? p.total_distance ?? 0,
        risk: p.risk ?? (p.name === 'LOWEST_RISK' ? 0.15 : p.name === 'FASTEST' ? 0.55 : 0.32),
        cost: p.cost ?? p.estimated_cost ?? 0,
        unmet_demand: p.unmet_demand ?? p.total_unmet_demand ?? 0,
        deliveries: p.deliveries || [],
        status: p.status || 'PENDING',
        description: p.description,
      }));

      setPlans(formattedPlans);

      // Identify currently approved active plan (if any)
      const approved = formattedPlans.find((p) => p.status === 'APPROVED');
      setActivePlan(approved || null);
    } catch (err: any) {
      console.error('Failed to load active plans:', err);
      setError(err?.message || 'Failed to fetch optimization plans.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshPlans();
  }, [refreshPlans]);

  // Synchronize across components when a plan decision event occurs
  useEffect(() => {
    const handleDecisionEvent = (e: any) => {
      const detail = e.detail;
      if (!detail || !detail.plan_id) return;

      setPlans((prev) =>
        prev.map((p) => {
          if (p.id === detail.plan_id) {
            return { ...p, status: detail.status };
          }
          // If another plan was approved, previous approved plan reverts to PENDING
          if (detail.status === 'APPROVED' && p.status === 'APPROVED') {
            return { ...p, status: 'PENDING' };
          }
          return p;
        })
      );

      if (detail.status === 'APPROVED') {
        setPlans((prev) => {
          const match = prev.find((p) => p.id === detail.plan_id);
          if (match) {
            setActivePlan({ ...match, status: 'APPROVED' });
          }
          return prev;
        });
      } else if (detail.status === 'REJECTED') {
        setActivePlan((prev) => (prev?.id === detail.plan_id ? null : prev));
      }
    };

    window.addEventListener('missionpath:plan_decision', handleDecisionEvent);
    return () => window.removeEventListener('missionpath:plan_decision', handleDecisionEvent);
  }, []);

  // Explicit Human Approval: POST /api/plans/{plan_id}/approve
  const approvePlan = async (planId: string, reason?: string): Promise<PlanDecisionResponse> => {
    try {
      setActionLoading(true);
      setError(null);

      const decisionReason = reason || 'Explicitly authorized by Human Logistics Commander.';
      const response = await apiService.postApprovePlan(planId, decisionReason);
      setLastDecision(response);

      // Update local state
      setPlans((prev) =>
        prev.map((p) => {
          if (p.id === planId) {
            return { ...p, status: 'APPROVED' };
          }
          if (p.status === 'APPROVED') {
            return { ...p, status: 'PENDING' };
          }
          return p;
        })
      );

      setPlans((current) => {
        const approved = current.find((p) => p.id === planId);
        if (approved) {
          setActivePlan({ ...approved, status: 'APPROVED' });
        }
        return current;
      });

      // Broadcast globally to update Dashboard, Timeline, and Map
      window.dispatchEvent(
        new CustomEvent('missionpath:plan_decision', {
          detail: {
            plan_id: planId,
            status: 'APPROVED',
            message: response.message,
            plan: response.plan,
          },
        })
      );

      window.dispatchEvent(
        new CustomEvent('missionpath:reoptimize', {
          detail: {
            id: planId,
            name: response.plan?.name || planId,
            status: 'APPROVED',
            optimization_status: 'OPTIMAL',
          },
        })
      );

      return response;
    } catch (err: any) {
      console.error(`Failed to approve plan ${planId}:`, err);
      setError(err?.message || `Failed to approve plan ${planId}`);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  // Explicit Human Rejection: POST /api/plans/{plan_id}/reject
  const rejectPlan = async (planId: string, reason?: string): Promise<PlanDecisionResponse> => {
    try {
      setActionLoading(true);
      setError(null);

      const decisionReason = reason || 'Rejected by Human Logistics Commander upon risk/resource review.';
      const response = await apiService.postRejectPlan(planId, decisionReason);
      setLastDecision(response);

      // Update local state
      setPlans((prev) =>
        prev.map((p) => {
          if (p.id === planId) {
            return { ...p, status: 'REJECTED' };
          }
          return p;
        })
      );

      setActivePlan((prev) => (prev?.id === planId ? null : prev));

      // Broadcast globally
      window.dispatchEvent(
        new CustomEvent('missionpath:plan_decision', {
          detail: {
            plan_id: planId,
            status: 'REJECTED',
            message: response.message,
            plan: response.plan,
          },
        })
      );

      return response;
    } catch (err: any) {
      console.error(`Failed to reject plan ${planId}:`, err);
      setError(err?.message || `Failed to reject plan ${planId}`);
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  return {
    plans,
    activePlan,
    loading,
    actionLoading,
    error,
    lastDecision,
    approvePlan,
    rejectPlan,
    refreshPlans,
  };
};

export default useActivePlan;

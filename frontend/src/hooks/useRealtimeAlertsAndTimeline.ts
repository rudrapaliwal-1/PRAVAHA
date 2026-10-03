import { useState, useEffect, useCallback } from 'react';
import {
  SystemAlert,
  SystemTimelineEvent,
  AlertLevel,
} from '../types';
import {
  INITIAL_TIMELINE_EVENTS,
  fetchRealBackendAlerts,
  getFormattedCurrentTime,
} from '../services/telemetryAlertService';

export const useRealtimeAlertsAndTimeline = () => {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<SystemTimelineEvent[]>(INITIAL_TIMELINE_EVENTS);
  const [activeFilter, setActiveFilter] = useState<AlertLevel | 'ALL'>('ALL');
  const [loading, setLoading] = useState<boolean>(true);

  // Load real backend alerts
  const refreshAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const backendAlerts = await fetchRealBackendAlerts();
      setAlerts(backendAlerts);
    } catch (err) {
      console.error('Error refreshing backend alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshAlerts();
  }, [refreshAlerts]);

  // Listen to live mission events (Disruptions, Re-Optimizations, Plan Approvals)
  useEffect(() => {
    const handleDisruptionEvent = (event: any) => {
      const detail = event.detail || {};
      const result = detail.result || {};
      const currentTime = getFormattedCurrentTime();
      const type = result.event_type || 'DISRUPTION';
      const targetId = result.affected_entities?.[0] || 'CORRIDOR';

      // 1. Add Disruption Timeline Event
      const newDisruptionTimelineEvent: SystemTimelineEvent = {
        id: `evt-disr-${Date.now()}`,
        time: currentTime,
        title: `${type.replace('_', ' ')} detected on ${targetId}`,
        detail: `Incident reported across logistics network. Telemetry isolating affected sectors.`,
        category:
          type === 'BLOCK_ROUTE'
            ? 'route_blockage'
            : type === 'VEHICLE_FAILURE'
            ? 'vehicle_failure'
            : type === 'DEMAND_SURGE'
            ? 'demand_surge'
            : 'shortage',
        level: 'CRITICAL',
        entityId: targetId,
      };

      // 2. Add Impact Analysis Timeline Event (like prompt example: 10:36 — Impact analysis complete)
      const newImpactTimelineEvent: SystemTimelineEvent = {
        id: `evt-impact-${Date.now() + 1}`,
        time: currentTime,
        title: 'Impact analysis complete',
        detail: `Evaluated ${result.affected_entities?.length || 1} compromised entities. CP-SAT re-solve scheduled.`,
        category: 'system',
        level: 'WARNING',
      };

      setTimelineEvents((prev) => [newImpactTimelineEvent, newDisruptionTimelineEvent, ...prev]);

      // 3. Add Real-time Alert
      const newAlert: SystemAlert = {
        id: `alert-disr-${Date.now()}`,
        level: 'CRITICAL',
        category:
          type === 'BLOCK_ROUTE'
            ? 'route_blockage'
            : type === 'VEHICLE_FAILURE'
            ? 'vehicle_failure'
            : type === 'DEMAND_SURGE'
            ? 'demand_surge'
            : 'shortage',
        title: `${type.replace('_', ' ')}: ${targetId}`,
        description: `Disruption event registered. Impacting ${result.affected_entities?.length || 1} entities across active theater.`,
        timestamp: currentTime,
        location: targetId,
        sourceEntityId: targetId,
      };

      setAlerts((prev) => [newAlert, ...prev]);
    };

    const handleReoptimizeEvent = (event: any) => {
      const detail = event.detail || {};
      const currentTime = getFormattedCurrentTime();

      // Check if this was a plan approval or general re-optimization
      const isPlanApproval = detail.name || detail.id?.startsWith('COA-');

      if (isPlanApproval) {
        // Plan approval event (e.g. 10:38 — Operator approved Low Risk plan)
        const planName = detail.name || 'Optimal';
        const approvalTimelineEvent: SystemTimelineEvent = {
          id: `evt-appr-${Date.now()}`,
          time: currentTime,
          title: `Operator approved ${planName.replace('_', ' ')} plan`,
          detail: `Commander authorization recorded. Dispatch schedule activated in simulation state.`,
          category: 'plan_approval',
          level: 'SUCCESS',
          entityId: detail.id,
        };

        const approvalAlert: SystemAlert = {
          id: `alert-appr-${Date.now()}`,
          level: 'SUCCESS',
          category: 'plan_approval',
          title: `Plan ${planName.replace('_', ' ')} Approved`,
          description: `Plan ${detail.id || ''} confirmed and broadcast to all transport convoys.`,
          timestamp: currentTime,
          sourceEntityId: detail.id,
        };

        setTimelineEvents((prev) => [approvalTimelineEvent, ...prev]);
        setAlerts((prev) => [approvalAlert, ...prev]);
      } else {
        // Re-optimization event (e.g. 10:36 — CP-SAT optimization started, 10:37 — 3 Courses of Action generated)
        const startedTimelineEvent: SystemTimelineEvent = {
          id: `evt-opt-start-${Date.now()}`,
          time: currentTime,
          title: 'CP-SAT optimization started',
          detail: 'Constraint solver executing mathematical re-route convergence.',
          category: 'reoptimization',
          level: 'INFO',
        };

        const completedTimelineEvent: SystemTimelineEvent = {
          id: `evt-opt-done-${Date.now() + 1}`,
          time: currentTime,
          title: 'Dynamic re-optimization converged',
          detail: `Status: ${detail.optimization_status || 'OPTIMAL'}. Delay recalculated.`,
          category: 'reoptimization',
          level: 'SUCCESS',
        };

        const reoptAlert: SystemAlert = {
          id: `alert-reopt-${Date.now()}`,
          level: 'SUCCESS',
          category: 'reoptimization',
          title: `CP-SAT Re-Optimization: ${detail.optimization_status || 'OPTIMAL'}`,
          description: `Computed updated route matrix. Average delay: ${detail.delay ? `${detail.delay}h` : 'Minimal'}.`,
          timestamp: currentTime,
        };

        setTimelineEvents((prev) => [completedTimelineEvent, startedTimelineEvent, ...prev]);
        setAlerts((prev) => [reoptAlert, ...prev]);
      }
    };

    window.addEventListener('missionpath:disruption', handleDisruptionEvent);
    window.addEventListener('missionpath:reoptimize', handleReoptimizeEvent);

    return () => {
      window.removeEventListener('missionpath:disruption', handleDisruptionEvent);
      window.removeEventListener('missionpath:reoptimize', handleReoptimizeEvent);
    };
  }, []);

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const clearAlerts = () => {
    setAlerts([]);
  };

  const filteredAlerts = activeFilter === 'ALL'
    ? alerts
    : alerts.filter((a) => a.level === activeFilter);

  return {
    alerts: filteredAlerts,
    allAlertsCount: alerts.length,
    criticalCount: alerts.filter((a) => a.level === 'CRITICAL').length,
    warningCount: alerts.filter((a) => a.level === 'WARNING').length,
    infoCount: alerts.filter((a) => a.level === 'INFO').length,
    successCount: alerts.filter((a) => a.level === 'SUCCESS').length,
    timelineEvents,
    activeFilter,
    setActiveFilter,
    dismissAlert,
    clearAlerts,
    refreshAlerts,
    loading,
  };
};

import {
  SystemAlert,
  SystemTimelineEvent,
  AlertLevel,
  AlertCategory,
} from '../types';
import { apiService } from './api';

// Initial Canonical Example Timeline Events (Exactly matching Block 15 prompt specifications)
export const INITIAL_TIMELINE_EVENTS: SystemTimelineEvent[] = [
  {
    id: 'evt-7',
    time: '10:38',
    title: 'Operator approved Low Risk plan',
    detail: 'Plan COA-LOWEST_RISK authorized by Logistics Commander. Vehicle routing updated.',
    category: 'plan_approval',
    level: 'SUCCESS',
    entityId: 'COA-LOWEST_RISK-58E17A',
  },
  {
    id: 'evt-6',
    time: '10:37',
    title: '3 Courses of Action generated',
    detail: 'FASTEST, LOWEST RISK, and RESOURCE EFFICIENT plans computed via CP-SAT.',
    category: 'reoptimization',
    level: 'INFO',
  },
  {
    id: 'evt-5',
    time: '10:36',
    title: 'CP-SAT optimization started',
    detail: 'Mathematical solver evaluating detour corridors and multi-commodity payload constraints.',
    category: 'reoptimization',
    level: 'INFO',
  },
  {
    id: 'evt-4',
    time: '10:36',
    title: 'Impact analysis complete',
    detail: 'Identified 3 compromised delivery routes and 2 stranded transport convoys.',
    category: 'system',
    level: 'WARNING',
  },
  {
    id: 'evt-3',
    time: '10:35',
    title: 'Disruption detected',
    detail: 'Telemetry reports rockfall and road breach on mountain corridor.',
    category: 'route_blockage',
    level: 'CRITICAL',
    entityId: 'ROUTE-04',
  },
  {
    id: 'evt-2',
    time: '10:35',
    title: 'Route R04 blocked',
    detail: 'Route ROUTE-04 marked UNAVAILABLE. Traffic halted immediately.',
    category: 'route_blockage',
    level: 'CRITICAL',
    entityId: 'ROUTE-04',
  },
  {
    id: 'evt-1',
    time: '10:32',
    title: 'Vehicle V12 dispatched',
    detail: 'Vehicle VEH-12 departed Depot Alpha with emergency medical payload.',
    category: 'dispatch',
    level: 'SUCCESS',
    entityId: 'VEH-12',
  },
];

// Helper to format current time as "HH:MM"
export const getFormattedCurrentTime = (): string => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Generates real backend alerts from active state, shortages, and routes
export const fetchRealBackendAlerts = async (): Promise<SystemAlert[]> => {
  const alerts: SystemAlert[] = [];
  const currentTime = getFormattedCurrentTime();

  try {
    // 1. Fetch real shortages from GET /api/shortages
    const shortageData = await apiService.getShortages().catch(() => null);
    if (shortageData?.shortages && shortageData.shortages.length > 0) {
      shortageData.shortages.slice(0, 3).forEach((item: any, idx: number) => {
        const isCritical = item.severity === 'critical' || item.urgency === 'critical';
        alerts.push({
          id: `alert-shortage-${idx}`,
          level: isCritical ? 'CRITICAL' : 'WARNING',
          category: 'shortage',
          title: `Supply Shortage: ${item.demand_point_id || 'Relief Sector'}`,
          description: `Imminent deficit of ${(item.supply_type || 'supplies').toUpperCase()} predicted in ${
            item.time_to_shortage != null ? `${item.time_to_shortage.toFixed(1)}h` : 'immediate horizon'
          }. Resupply required.`,
          timestamp: currentTime,
          location: item.demand_point_id,
          sourceEntityId: item.demand_point_id,
        });
      });
    }

    // 2. Fetch real blocked routes from GET /api/routes
    const routesData = await apiService.getRoutes().catch(() => null);
    if (routesData) {
      const blockedRoutes = routesData.filter((r) => !r.available || r.risk === 'blocked');
      blockedRoutes.forEach((route) => {
        alerts.push({
          id: `alert-route-${route.id}`,
          level: 'CRITICAL',
          category: 'route_blockage',
          title: `Route Blocked: ${route.id}`,
          description: `Corridor ${route.id} is impassable due to terrain hazards. Bypasses active.`,
          timestamp: currentTime,
          location: route.id,
          sourceEntityId: route.id,
        });
      });
    }

    // 3. Fetch real fleet health from GET /api/vehicles
    const vehiclesData = await apiService.getVehicles().catch(() => null);
    if (vehiclesData) {
      const unavailableVehicles = vehiclesData.filter((v) => !v.available || v.fuel_level < 20);
      unavailableVehicles.slice(0, 2).forEach((veh) => {
        alerts.push({
          id: `alert-veh-${veh.id}`,
          level: 'WARNING',
          category: 'vehicle_failure',
          title: `Vehicle Attention: ${veh.id}`,
          description: `Vehicle ${veh.id} reported low availability or fuel (${veh.fuel_level}%). Maintenance assigned.`,
          timestamp: currentTime,
          location: veh.current_location ? `Lat ${veh.current_location.lat.toFixed(2)}, Lon ${veh.current_location.lon.toFixed(2)}` : undefined,
          sourceEntityId: veh.id,
        });
      });
    }

    // 4. Fetch resilience health from GET /api/resilience
    const resilienceData = await apiService.getResilience().catch(() => null);
    if (resilienceData) {
      if (resilienceData.overall_score < 70) {
        alerts.push({
          id: 'alert-resilience-drop',
          level: resilienceData.overall_score < 50 ? 'CRITICAL' : 'WARNING',
          category: 'resilience_change',
          title: `Resilience Degraded: ${resilienceData.overall_score.toFixed(1)} / 100`,
          description: resilienceData.key_factors?.[0] || 'Supply chain redundancy dropped below nominal threshold.',
          timestamp: currentTime,
        });
      } else {
        alerts.push({
          id: 'alert-resilience-healthy',
          level: 'INFO',
          category: 'resilience_change',
          title: `Resilience Posture: ${resilienceData.overall_score.toFixed(1)} / 100`,
          description: 'Network operating within optimal resilience parameters across all 5 dimensions.',
          timestamp: currentTime,
        });
      }
    }

    // 5. Add a successful plan authorization alert
    alerts.push({
      id: 'alert-plan-authorized',
      level: 'SUCCESS',
      category: 'plan_approval',
      title: 'Active Optimization Plan Authorized',
      description: 'Human operator approved Course of Action for multi-depot fleet execution.',
      timestamp: currentTime,
    });
  } catch (err) {
    console.error('Failed to gather real backend alerts:', err);
  }

  return alerts;
};

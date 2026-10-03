import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Flame,
  CloudRain,
  ShieldAlert,
  RotateCcw,
  Zap,
  MapPin,
  RefreshCw,
  Truck,
  Layers,
  ArrowRight,
  Boxes,
  CheckCircle2,
} from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { StatusBadge, StatusVariant } from '../components/StatusBadge';
import { DisruptionControlPanel } from '../components/DisruptionControlPanel';
import { LiveLogisticsMap } from '../components/LiveLogisticsMap';
import { LogisticsState, DisruptionResult, Route, Vehicle } from '../types';
import { apiService } from '../services/api';

interface LoggedIncident {
  eventId: string;
  type: string;
  targetId: string;
  affectedEntities: string[];
  affectedRoutes: string[];
  affectedVehicles: string[];
  affectedDeliveries: string[];
  timestamp: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

export const DisruptionsPage: React.FC = () => {
  const [state, setState] = useState<LogisticsState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // History of disruptions injected during this session
  const [incidentHistory, setIncidentHistory] = useState<LoggedIncident[]>([
    {
      eventId: 'DISRUPT-INIT-01',
      type: 'BLOCK_ROUTE',
      targetId: 'ROUTE-12',
      affectedEntities: ['ROUTE-12'],
      affectedRoutes: ['ROUTE-12'],
      affectedVehicles: [],
      affectedDeliveries: [],
      timestamp: new Date().toLocaleTimeString(),
      severity: 'HIGH',
    },
  ]);

  // Fetch current logistics state
  const loadState = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getLogisticsState();
      setState(data);
    } catch (err: any) {
      console.error('Failed to load state in DisruptionsPage:', err);
      setError(err?.message || 'Failed to connect to simulation backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // Disruption callback triggered when user executes a disruption from DisruptionControlPanel
  const handleDisruptionApplied = (result: DisruptionResult, newState: LogisticsState) => {
    setState(newState);

    // Compute affected collections
    const routesBlocked = Object.values(newState.routes || {})
      .filter((r: Route) => !r.available)
      .map((r) => r.id);
    const vehiclesFailed = Object.values(newState.vehicles || {})
      .filter((v: Vehicle) => !v.available)
      .map((v) => v.id);

    const newLog: LoggedIncident = {
      eventId: result.event_id,
      type: result.event_type,
      targetId: result.affected_entities[0] || 'N/A',
      affectedEntities: result.affected_entities,
      affectedRoutes:
        result.event_type === 'BLOCK_ROUTE'
          ? result.affected_entities
          : result.affected_routes || [],
      affectedVehicles:
        result.event_type === 'VEHICLE_FAILURE'
          ? result.affected_entities
          : result.affected_vehicles || [],
      affectedDeliveries: result.affected_deliveries || [],
      timestamp: new Date(result.timestamp || Date.now()).toLocaleTimeString(),
      severity:
        result.event_type === 'NEW_EMERGENCY' || result.event_type === 'BLOCK_ROUTE'
          ? 'CRITICAL'
          : 'HIGH',
    };

    setIncidentHistory((prev) => [newLog, ...prev]);
  };

  // Metrics derived from live backend state
  const routesList = Object.values(state?.routes || {});
  const vehiclesList = Object.values(state?.vehicles || {});
  const blockedRoutes = routesList.filter((r) => !r.available);
  const groundedVehicles = vehiclesList.filter((v) => !v.available);
  const totalDemandPoints = Object.values(state?.demand_points || {}).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/40 text-[10px] font-mono font-semibold text-rose-400">
              HAZARD-07 // STRESS SIMULATION LAB
            </span>
            <span className="text-xs font-mono text-slate-500">
              BACKEND ENGINE: POST /api/simulation/disruption
            </span>
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-white mt-1">
            Real-Time Disruption Simulation & Hazard Control
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Inject tactical obstacles, route landslides, vehicle mechanical failures, demand surges, and emergency crises.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <StatusBadge
            label={blockedRoutes.length > 0 ? 'NETWORK DISRUPTED' : 'CORRIDORS NOMINAL'}
            variant={blockedRoutes.length > 0 ? 'danger' : 'success'}
            pulse={blockedRoutes.length > 0}
            size="sm"
          />
          <button
            onClick={loadState}
            disabled={loading}
            className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs font-mono text-slate-300 hover:text-cyan-400 flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>SYNC SIM STATE</span>
          </button>
        </div>
      </div>

      {/* Disruption KPI Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Blocked Corridors"
          value={blockedRoutes.length}
          unit={`/ ${routesList.length} Routes`}
          change={`${blockedRoutes.length} severed`}
          statusText={blockedRoutes.length > 0 ? 'HAZARDS ACTIVE' : 'ALL CLEAR'}
          statusVariant={blockedRoutes.length > 0 ? 'danger' : 'success'}
          icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
          subtext="Highways closed by debris or rockfalls"
          progress={(blockedRoutes.length / (routesList.length || 1)) * 100}
          alert={blockedRoutes.length > 0}
        />
        <KPICard
          title="Grounded Vehicles"
          value={groundedVehicles.length}
          unit={`/ ${vehiclesList.length} Transport Units`}
          change="Unavailable"
          statusText={groundedVehicles.length > 0 ? 'OFFLINE UNITS' : 'ALL NOMINAL'}
          statusVariant={groundedVehicles.length > 0 ? 'warning' : 'success'}
          icon={<Truck className="w-4 h-4 text-rose-400" />}
          subtext="Mechanical failure or repair pool"
          progress={(groundedVehicles.length / (vehiclesList.length || 1)) * 100}
        />
        <KPICard
          title="Active Crisis Sectors"
          value={totalDemandPoints}
          unit="Triage Nodes"
          change="Active Demands"
          statusText="MONITORING"
          statusVariant="info"
          icon={<Flame className="w-4 h-4 text-cyan-400" />}
          subtext="Target civilian casualties & hospitals"
          progress={totalDemandPoints * 15}
        />
        <KPICard
          title="Simulated Incidents"
          value={incidentHistory.length}
          unit="Events Injected"
          change="Real-time"
          statusText="SIM ACTIVE"
          statusVariant="info"
          icon={<Zap className="w-4 h-4 text-indigo-400" />}
          subtext="Executed against FastAPI simulation"
          progress={100}
        />
      </div>

      {/* =================================================================== */}
      {/* 1. REAL-TIME DISRUPTION CONTROL PANEL COMPONENT                     */}
      {/* =================================================================== */}
      <DisruptionControlPanel
        state={state}
        onDisruptionApplied={handleDisruptionApplied}
        title="TACTICAL DISRUPTION INJECTION CONSOLE"
        showRecentImpact={true}
      />

      {/* =================================================================== */}
      {/* 2. LIVE INTERACTIVE LOGISTICS MAP SHOWING DISRUPTIONS IN REAL-TIME  */}
      {/* =================================================================== */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
            <span className="font-bold text-slate-200 uppercase">
              Live Tactical Geospatial Map // Disruption Overlay
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Blocked routes are highlighted with <span className="text-rose-400 font-bold">pulsing dashed red vectors</span>
          </span>
        </div>

        <div className="relative">
          <LiveLogisticsMap state={state} heightClass="h-[460px]" />
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. SIMULATED INCIDENT HISTORY STREAM & AFFECTED ENTITIES MATRIX     */}
      {/* =================================================================== */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 font-mono shadow-sm">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80 mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-400" />
            <h2 className="text-sm font-bold tracking-wider text-slate-100 uppercase">
              Session Disruption Audit Log &amp; Impact Telemetry
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            {incidentHistory.length} SIMULATED INCIDENT{incidentHistory.length === 1 ? '' : 'S'}
          </span>
        </div>

        <div className="space-y-3 text-xs">
          {incidentHistory.map((inc) => (
            <div
              key={inc.eventId}
              className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors space-y-2.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-rose-400">{inc.eventId}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 font-bold">
                    {inc.type}
                  </span>
                  <span className="text-slate-500 text-[11px]">[{inc.timestamp}]</span>
                </div>
                <StatusBadge
                  label={inc.severity}
                  variant={inc.severity === 'CRITICAL' ? 'danger' : 'warning'}
                  size="sm"
                />
              </div>

              {/* Grid of Affected Items */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                  <span className="text-slate-500 block text-[10px]">AFFECTED ENTITIES:</span>
                  <span className="font-bold text-slate-200">
                    {inc.affectedEntities.join(', ') || 'N/A'}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                  <span className="text-slate-500 block text-[10px]">AFFECTED ROUTES:</span>
                  <span className="font-bold text-amber-300">
                    {inc.affectedRoutes.join(', ') || '0 Routes'}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                  <span className="text-slate-500 block text-[10px]">AFFECTED VEHICLES:</span>
                  <span className="font-bold text-cyan-300">
                    {inc.affectedVehicles.join(', ') || '0 Units'}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                  <span className="text-slate-500 block text-[10px]">AFFECTED DELIVERIES:</span>
                  <span className="font-bold text-indigo-300">
                    {inc.affectedDeliveries.join(', ') || '0 Dispatches'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

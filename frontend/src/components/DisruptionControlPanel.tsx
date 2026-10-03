import React, { useState } from 'react';
import {
  AlertTriangle,
  Truck,
  TrendingUp,
  Package,
  Flame,
  X,
  Send,
  RefreshCw,
  CheckCircle2,
  MapPin,
  ShieldAlert,
  ArrowRight,
  Zap,
  Info,
} from 'lucide-react';
import {
  LogisticsState,
  DisruptionRequest,
  DisruptionResult,
  DisruptionType,
  Route,
  Vehicle,
  DemandPoint,
  Depot,
} from '../types';
import { apiService } from '../services/api';
import { StatusBadge } from './StatusBadge';
import { useConnectivity } from '../context/ConnectivityContext';

export interface DisruptionControlPanelProps {
  state: LogisticsState | null;
  onDisruptionApplied?: (result: DisruptionResult, newState: LogisticsState) => void;
  title?: string;
  showRecentImpact?: boolean;
}

interface DisruptionImpactAnalysis {
  result: DisruptionResult;
  affectedRoutes: string[];
  affectedVehicles: string[];
  affectedDeliveries: string[];
}

export const DisruptionControlPanel: React.FC<DisruptionControlPanelProps> = ({
  state,
  onDisruptionApplied,
  title = 'REAL-TIME DISRUPTION SIMULATION CONTROL',
  showRecentImpact = true,
}) => {
  const { isOffline } = useConnectivity();

  // Modal state
  const [activeModalType, setActiveModalType] = useState<DisruptionType | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [paramMultiplier, setParamMultiplier] = useState<number>(2.0);
  const [paramLossFraction, setParamLossFraction] = useState<number>(0.5);
  const [paramSupplyType, setParamSupplyType] = useState<string>('all');
  const [paramEmergencyName, setParamEmergencyName] = useState<string>('Disaster Sector Foxtrot');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Latest impact record
  const [latestImpact, setLatestImpact] = useState<DisruptionImpactAnalysis | null>(null);

  // Lists of selectable entities from current state
  const availableRoutes = Object.values(state?.routes || {}).filter((r: Route) => r.available);
  const availableVehicles = Object.values(state?.vehicles || {}).filter((v: Vehicle) => v.available);
  const demandPoints = Object.values(state?.demand_points || {});
  const depots = Object.values(state?.depots || {});

  // Open modal handler with smart default pre-selection
  const handleOpenModal = (type: DisruptionType) => {
    setActiveModalType(type);
    setSubmitError(null);

    if (type === 'BLOCK_ROUTE' && availableRoutes.length > 0) {
      setSelectedTargetId(availableRoutes[0].id);
    } else if (type === 'VEHICLE_FAILURE' && availableVehicles.length > 0) {
      setSelectedTargetId(availableVehicles[0].id);
    } else if (type === 'DEMAND_SURGE' && demandPoints.length > 0) {
      setSelectedTargetId(demandPoints[0].id);
    } else if (type === 'INVENTORY_SHORTAGE' && depots.length > 0) {
      setSelectedTargetId(depots[0].id);
    } else if (type === 'NEW_EMERGENCY') {
      setSelectedTargetId(`DEMAND-EMERGENCY-${Math.floor(100 + Math.random() * 900)}`);
    } else {
      setSelectedTargetId('');
    }
  };

  const handleCloseModal = () => {
    setActiveModalType(null);
    setSelectedTargetId('');
    setSubmitError(null);
  };

  // Submit disruption to backend simulation endpoint POST /api/simulation/disruption
  const handleSubmitDisruption = async () => {
    if (!activeModalType) return;

    try {
      setSubmitting(true);
      setSubmitError(null);

      const payload: DisruptionRequest = {
        type: activeModalType,
        target_id: selectedTargetId || null,
        parameters: {},
      };

      if (activeModalType === 'DEMAND_SURGE') {
        payload.parameters = {
          multiplier: paramMultiplier,
          ...(paramSupplyType !== 'all' ? { supply_type: paramSupplyType } : {}),
        };
      } else if (activeModalType === 'INVENTORY_SHORTAGE') {
        payload.parameters = {
          loss_fraction: paramLossFraction,
          ...(paramSupplyType !== 'all' ? { supply_type: paramSupplyType } : {}),
        };
      } else if (activeModalType === 'NEW_EMERGENCY') {
        payload.parameters = {
          id: selectedTargetId,
          name: paramEmergencyName,
          location: { lat: 30.45, lon: 78.35 },
          required_supplies: {
            medicine: 1500.0,
            water: 5000.0,
            food: 3500.0,
          },
          consumption_rate: {
            medicine: 60.0,
            water: 150.0,
            food: 95.0,
          },
          priority: 'critical',
        };
      }

      // 1. Call Backend Simulation API (Single Source of Truth)
      const result: DisruptionResult = await apiService.postDisruption(payload);

      // 2. Fetch the updated state from backend
      const newState: LogisticsState = await apiService.getLogisticsState();

      // 3. Calculate affected routes, vehicles, deliveries from the new state & result
      const target = selectedTargetId;
      const affectedRoutes: string[] = [];
      const affectedVehicles: string[] = [];
      const affectedDeliveries: string[] = [];

      if (activeModalType === 'BLOCK_ROUTE') {
        affectedRoutes.push(target);
        // Find deliveries routed via this route
        (newState.deliveries || []).forEach((del) => {
          if (del.source_id && del.destination_id) {
            affectedDeliveries.push(del.id);
            if (del.vehicle_id && !affectedVehicles.includes(del.vehicle_id)) {
              affectedVehicles.push(del.vehicle_id);
            }
          }
        });
      } else if (activeModalType === 'VEHICLE_FAILURE') {
        affectedVehicles.push(target);
        (newState.deliveries || []).forEach((del) => {
          if (del.vehicle_id === target) {
            affectedDeliveries.push(del.id);
          }
        });
      } else if (activeModalType === 'DEMAND_SURGE') {
        (newState.deliveries || []).forEach((del) => {
          if (del.destination_id === target) {
            affectedDeliveries.push(del.id);
            if (del.vehicle_id && !affectedVehicles.includes(del.vehicle_id)) {
              affectedVehicles.push(del.vehicle_id);
            }
          }
        });
        Object.values(newState.routes || {}).forEach((r) => {
          const dp = newState.demand_points?.[target];
          if (dp && r.destination.lat === dp.location.lat && r.destination.lon === dp.location.lon) {
            affectedRoutes.push(r.id);
          }
        });
      } else if (activeModalType === 'INVENTORY_SHORTAGE') {
        (newState.deliveries || []).forEach((del) => {
          if (del.source_id === target) {
            affectedDeliveries.push(del.id);
            if (del.vehicle_id && !affectedVehicles.includes(del.vehicle_id)) {
              affectedVehicles.push(del.vehicle_id);
            }
          }
        });
        Object.values(newState.routes || {}).forEach((r) => {
          const depot = newState.depots?.[target];
          if (depot && r.source.lat === depot.location.lat && r.source.lon === depot.location.lon) {
            affectedRoutes.push(r.id);
          }
        });
      } else if (activeModalType === 'NEW_EMERGENCY') {
        if (result.state_changes?.created_routes) {
          affectedRoutes.push(...result.state_changes.created_routes);
        }
      }

      const impactAnalysis: DisruptionImpactAnalysis = {
        result,
        affectedRoutes: Array.from(new Set(affectedRoutes)),
        affectedVehicles: Array.from(new Set(affectedVehicles)),
        affectedDeliveries: Array.from(new Set(affectedDeliveries)),
      };

      setLatestImpact(impactAnalysis);
      handleCloseModal();

      // 4. Update the dashboard state across parent components
      if (onDisruptionApplied) {
        onDisruptionApplied(result, newState);
      }

      // Notify global listeners (e.g. Resilience dashboard)
      window.dispatchEvent(new CustomEvent('missionpath:disruption', { detail: { result, newState } }));
    } catch (err: any) {
      console.error('Failed to apply disruption:', err);
      setSubmitError(err?.message || 'Failed to inject disruption scenario.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg backdrop-blur">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3.5 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-rose-400 animate-pulse" />
          <h2 className="text-sm font-bold font-mono tracking-wider text-slate-100 uppercase">
            {title}
          </h2>
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          ENDPOINT: POST /api/simulation/disruption
        </span>
      </div>

      <p className="text-xs font-mono text-slate-400 mt-2">
        Inject operational stressors directly into the live military & disaster logistics simulation.
      </p>

      {/* =================================================================== */}
      {/* 5 DISRUPTION BUTTONS REQUIRED BY SPEC                               */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
        {/* 1. BLOCK ROUTE */}
        <button
          onClick={() => handleOpenModal('BLOCK_ROUTE')}
          disabled={isOffline || submitting}
          className={`group relative px-3 py-3 rounded-lg border font-mono text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
            isOffline
              ? 'border-slate-800 bg-slate-900/50 text-slate-500 cursor-not-allowed opacity-60'
              : 'border-amber-500/50 bg-amber-950/40 hover:bg-amber-950/70 text-amber-300 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:border-amber-400 active:scale-[0.98]'
          }`}
          title={isOffline ? 'Disabled in simulated offline mode' : 'Simulate route obstruction'}
        >
          <span className="text-base">🚧</span>
          <span>BLOCK ROUTE</span>
        </button>

        {/* 2. VEHICLE FAILURE */}
        <button
          onClick={() => handleOpenModal('VEHICLE_FAILURE')}
          disabled={isOffline || submitting}
          className={`group relative px-3 py-3 rounded-lg border font-mono text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
            isOffline
              ? 'border-slate-800 bg-slate-900/50 text-slate-500 cursor-not-allowed opacity-60'
              : 'border-rose-500/50 bg-rose-950/40 hover:bg-rose-950/70 text-rose-300 hover:shadow-[0_0_15px_rgba(244,63,94,0.35)] hover:border-rose-400 active:scale-[0.98]'
          }`}
          title={isOffline ? 'Disabled in simulated offline mode' : 'Simulate vehicle breakdown'}
        >
          <span className="text-base">🚚</span>
          <span>VEHICLE FAILURE</span>
        </button>

        {/* 3. DEMAND SURGE */}
        <button
          onClick={() => handleOpenModal('DEMAND_SURGE')}
          disabled={isOffline || submitting}
          className={`group relative px-3 py-3 rounded-lg border font-mono text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
            isOffline
              ? 'border-slate-800 bg-slate-900/50 text-slate-500 cursor-not-allowed opacity-60'
              : 'border-cyan-500/50 bg-cyan-950/40 hover:bg-cyan-950/70 text-cyan-300 hover:shadow-glow-cyan hover:border-cyan-400 active:scale-[0.98]'
          }`}
          title={isOffline ? 'Disabled in simulated offline mode' : 'Simulate demand spike'}
        >
          <span className="text-base">📈</span>
          <span>DEMAND SURGE</span>
        </button>

        {/* 4. INVENTORY SHORTAGE */}
        <button
          onClick={() => handleOpenModal('INVENTORY_SHORTAGE')}
          disabled={isOffline || submitting}
          className={`group relative px-3 py-3 rounded-lg border font-mono text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
            isOffline
              ? 'border-slate-800 bg-slate-900/50 text-slate-500 cursor-not-allowed opacity-60'
              : 'border-indigo-500/50 bg-indigo-950/40 hover:bg-indigo-950/70 text-indigo-300 hover:shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:border-indigo-400 active:scale-[0.98]'
          }`}
          title={isOffline ? 'Disabled in simulated offline mode' : 'Simulate inventory loss'}
        >
          <span className="text-base">📦</span>
          <span>INVENTORY SHORTAGE</span>
        </button>

        {/* 5. NEW EMERGENCY */}
        <button
          onClick={() => handleOpenModal('NEW_EMERGENCY')}
          disabled={isOffline || submitting}
          className={`group relative px-3 py-3 rounded-lg border font-mono text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
            isOffline
              ? 'border-slate-800 bg-slate-900/50 text-slate-500 cursor-not-allowed opacity-60'
              : 'border-red-500/70 bg-red-950/50 hover:bg-red-900/60 text-white shadow-[0_0_12px_rgba(239,68,68,0.3)] hover:shadow-glow-red hover:border-red-400 active:scale-[0.98] animate-pulse'
          }`}
          title={isOffline ? 'Disabled in simulated offline mode' : 'Inject new critical casualty site'}
        >
          <span className="text-base">🚨</span>
          <span>NEW EMERGENCY</span>
        </button>
      </div>

      {/* Offline Notice Banner */}
      {isOffline && (
        <div className="mt-3 p-3 rounded-lg border border-rose-500/40 bg-rose-950/30 text-rose-300 font-mono text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm">🔴</span>
            <span>
              <strong>OFFLINE MODE ACTIVE:</strong> Disruption stress injection requires live backend communication. Currently operating on cached telemetry.
            </span>
          </div>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-900/60 border border-rose-500/50">
            LOCKED
          </span>
        </div>
      )}

      {/* =================================================================== */}
      {/* REQUIRED IMPACT REPORT: SHOW DISRUPTION TYPE & AFFECTED ENTITIES    */}
      {/* =================================================================== */}
      {showRecentImpact && latestImpact && (
        <div className="mt-5 p-4 rounded-lg bg-slate-950 border border-rose-500/40 font-mono relative overflow-hidden shadow-md">
          <div className="flex items-start justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span className="text-xs font-bold text-rose-300 uppercase tracking-wider">
                ACTIVE INCIDENT APPLIED // {latestImpact.result.event_id}
              </span>
            </div>
            <span className="text-[10px] text-slate-500">
              {new Date(latestImpact.result.timestamp).toLocaleTimeString()} UTC
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-3 text-xs">
            {/* 1. DISRUPTION TYPE */}
            <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">
                DISRUPTION TYPE:
              </span>
              <span className="text-sm font-bold text-rose-400 mt-0.5 block">
                {latestImpact.result.event_type}
              </span>
            </div>

            {/* 2. AFFECTED ENTITIES */}
            <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">
                AFFECTED ENTITIES:
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {latestImpact.result.affected_entities.length > 0 ? (
                  latestImpact.result.affected_entities.map((ent) => (
                    <span
                      key={ent}
                      className="px-1.5 py-0.5 rounded bg-rose-950/70 border border-rose-500/50 text-[10px] font-bold text-rose-300"
                    >
                      {ent}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 text-[11px]">None</span>
                )}
              </div>
            </div>

            {/* 3. AFFECTED ROUTES */}
            <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">
                AFFECTED ROUTES:
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {latestImpact.affectedRoutes.length > 0 ? (
                  latestImpact.affectedRoutes.map((rId) => (
                    <span
                      key={rId}
                      className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-500/50 text-[10px] font-bold text-amber-300"
                    >
                      {rId}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 text-[11px]">0 Routes</span>
                )}
              </div>
            </div>

            {/* 4. AFFECTED VEHICLES */}
            <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">
                AFFECTED VEHICLES:
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {latestImpact.affectedVehicles.length > 0 ? (
                  latestImpact.affectedVehicles.map((vId) => (
                    <span
                      key={vId}
                      className="px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/50 text-[10px] font-bold text-cyan-300"
                    >
                      {vId}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 text-[11px]">0 Units</span>
                )}
              </div>
            </div>

            {/* 5. AFFECTED DELIVERIES */}
            <div className="p-2.5 rounded bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">
                AFFECTED DELIVERIES:
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {latestImpact.affectedDeliveries.length > 0 ? (
                  latestImpact.affectedDeliveries.map((delId) => (
                    <span
                      key={delId}
                      className="px-1.5 py-0.5 rounded bg-indigo-950/70 border border-indigo-500/50 text-[10px] font-bold text-indigo-300"
                    >
                      {delId}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 text-[11px]">0 Pending</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>State synchronized with backend simulation engine.</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> MAP &amp; DASHBOARD UPDATED
            </span>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TARGET SELECTOR MODAL DIALOG                                        */}
      {/* =================================================================== */}
      {activeModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in font-mono">
          <div className="w-full max-w-lg bg-slate-950 border border-slate-700/80 rounded-xl p-5 shadow-2xl relative text-xs">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white tracking-wide uppercase">
                  SIMULATION TARGET: {activeModalType.replace('_', ' ')}
                </h3>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {submitError && (
              <div className="mt-3 p-2.5 rounded bg-rose-950/70 border border-rose-500/50 text-rose-300 text-xs">
                {submitError}
              </div>
            )}

            {/* Modal Body: Target Selector By Disruption Type */}
            <div className="mt-4 space-y-4">
              {/* 1. BLOCK ROUTE MODAL */}
              {activeModalType === 'BLOCK_ROUTE' && (
                <div className="space-y-3">
                  <label className="block text-slate-400 font-bold uppercase text-[11px]">
                    Select Highway / Corridor to Block:
                  </label>
                  <select
                    value={selectedTargetId}
                    onChange={(e) => setSelectedTargetId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    {availableRoutes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.id} — Distance: {r.distance} km, Travel: {r.travel_time}h (Risk: {r.risk})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">
                    Blocking will mark the route as <span className="text-rose-400 font-bold">BLOCKED</span>, cutting transport accessibility and rendering route lines red on the map.
                  </p>
                </div>
              )}

              {/* 2. VEHICLE FAILURE MODAL */}
              {activeModalType === 'VEHICLE_FAILURE' && (
                <div className="space-y-3">
                  <label className="block text-slate-400 font-bold uppercase text-[11px]">
                    Select Active Vehicle for Breakdown:
                  </label>
                  <select
                    value={selectedTargetId}
                    onChange={(e) => setSelectedTargetId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-rose-500"
                  >
                    {availableVehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.id} — Capacity: {v.capacity} kg, Fuel: {v.fuel_level}%, Speed: {v.speed} km/h
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">
                    Vehicle failure will ground the unit (<span className="text-rose-400 font-bold">available = false</span>) and require emergency payload transfer.
                  </p>
                </div>
              )}

              {/* 3. DEMAND SURGE MODAL */}
              {activeModalType === 'DEMAND_SURGE' && (
                <div className="space-y-3">
                  <label className="block text-slate-400 font-bold uppercase text-[11px]">
                    Select Target Demand Location:
                  </label>
                  <select
                    value={selectedTargetId}
                    onChange={(e) => setSelectedTargetId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    {demandPoints.map((dp) => (
                      <option key={dp.id} value={dp.id}>
                        {dp.id} — Priority: {dp.priority.toUpperCase()} ({dp.location.lat.toFixed(2)}°N, {dp.location.lon.toFixed(2)}°E)
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">
                        Surge Multiplier:
                      </label>
                      <select
                        value={paramMultiplier}
                        onChange={(e) => setParamMultiplier(parseFloat(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                      >
                        <option value={1.5}>1.5x (Moderate Surge)</option>
                        <option value={2.0}>2.0x (Severe Casualty Spike)</option>
                        <option value={2.5}>2.5x (Major Influx)</option>
                        <option value={3.0}>3.0x (Extreme Crisis)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">
                        Target Supply:
                      </label>
                      <select
                        value={paramSupplyType}
                        onChange={(e) => setParamSupplyType(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                      >
                        <option value="all">All Supplies</option>
                        <option value="medicine">Medical Only</option>
                        <option value="water">Water Only</option>
                        <option value="food">Food Only</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. INVENTORY SHORTAGE MODAL */}
              {activeModalType === 'INVENTORY_SHORTAGE' && (
                <div className="space-y-3">
                  <label className="block text-slate-400 font-bold uppercase text-[11px]">
                    Select Target Supply Depot:
                  </label>
                  <select
                    value={selectedTargetId}
                    onChange={(e) => setSelectedTargetId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {depots.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.id} — Inventory items: {Object.keys(d.inventory || {}).length}
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">
                        Inventory Reduction:
                      </label>
                      <select
                        value={paramLossFraction}
                        onChange={(e) => setParamLossFraction(parseFloat(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                      >
                        <option value={0.25}>25% Reduction</option>
                        <option value={0.50}>50% Loss (Contamination/Fire)</option>
                        <option value={0.75}>75% Catastrophic Loss</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">
                        Supply Category:
                      </label>
                      <select
                        value={paramSupplyType}
                        onChange={(e) => setParamSupplyType(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
                      >
                        <option value="all">All Inventory</option>
                        <option value="fuel">Fuel Reserves</option>
                        <option value="water">Potable Water</option>
                        <option value="medicine">Medical Aid</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. NEW EMERGENCY MODAL */}
              {activeModalType === 'NEW_EMERGENCY' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">
                      Emergency Location Identifier:
                    </label>
                    <input
                      type="text"
                      value={selectedTargetId}
                      onChange={(e) => setSelectedTargetId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-200 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[10px] uppercase font-bold mb-1">
                      Sector / Incident Descriptor:
                    </label>
                    <input
                      type="text"
                      value={paramEmergencyName}
                      onChange={(e) => setParamEmergencyName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-200"
                    />
                  </div>

                  <p className="text-[11px] text-slate-500">
                    A sudden flash disaster will be registered at coordinates (30.4500°N, 78.3500°E) with Priority <span className="text-rose-400 font-bold">CRITICAL</span> and automatic connector routes to all staging depots.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
              <button
                onClick={handleCloseModal}
                disabled={submitting}
                className="px-3 py-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold"
              >
                CANCEL
              </button>
              <button
                onClick={handleSubmitDisruption}
                disabled={submitting}
                className="px-4 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 shadow-glow-red transition-colors"
              >
                {submitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>INJECT DISRUPTION SCENARIO</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

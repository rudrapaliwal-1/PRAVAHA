import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Truck,
  Fuel,
  Gauge,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  LayoutGrid,
  List,
  X,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Sliders,
  Wrench,
  Activity,
  Layers,
} from 'lucide-react';
import { StatusBadge, StatusVariant } from '../components/StatusBadge';
import { KPICard } from '../components/KPICard';
import { Vehicle, VehicleHealthStatus, MaintenanceRisk } from '../types';
import { apiService } from '../services/api';

type FilterCategory = 'all' | 'available' | 'busy' | 'unavailable' | 'high_risk';

export const FleetPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [healthMap, setHealthMap] = useState<Record<string, VehicleHealthStatus>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // Fetch vehicles and health data concurrently from Person 1 backend
  const loadFleetData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [vehiclesRes, healthRes] = await Promise.all([
        apiService.getVehicles(),
        apiService.getVehicleHealth().catch(() => null),
      ]);

      setVehicles(vehiclesRes || []);

      if (healthRes && healthRes.vehicles) {
        const mapping: Record<string, VehicleHealthStatus> = {};
        healthRes.vehicles.forEach((vh) => {
          mapping[vh.vehicle_id] = vh;
        });
        setHealthMap(mapping);
      }
    } catch (err: any) {
      console.error('Failed to load fleet data:', err);
      setError(err?.message || 'Unable to connect to vehicle telemetry backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFleetData();
  }, [loadFleetData]);

  // Selected vehicle object and corresponding health status
  const selectedVehicle = useMemo(() => {
    if (!selectedVehicleId) return null;
    return vehicles.find((v) => v.id === selectedVehicleId) || null;
  }, [vehicles, selectedVehicleId]);

  const selectedVehicleHealth = useMemo(() => {
    if (!selectedVehicleId) return null;
    return healthMap[selectedVehicleId] || null;
  }, [healthMap, selectedVehicleId]);

  // Derived filtered vehicles list
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const health = healthMap[v.id];
      const isAvailable = v.available && v.fuel_level > 0;
      const isBusy = !v.available && health?.is_operational;
      const isUnavailable = !v.available || v.fuel_level <= 0 || (health && !health.is_operational);
      const isHighRisk = health?.maintenance_risk === 'HIGH';

      // Category filter
      if (activeFilter === 'available' && !isAvailable) return false;
      if (activeFilter === 'busy' && !isBusy) return false;
      if (activeFilter === 'unavailable' && !isUnavailable) return false;
      if (activeFilter === 'high_risk' && !isHighRisk) return false;

      // Search query filter (by ID or coordinates)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesId = v.id.toLowerCase().includes(query);
        const matchesCoords = `${v.current_location.lat},${v.current_location.lon}`.includes(query);
        if (!matchesId && !matchesCoords) return false;
      }

      return true;
    });
  }, [vehicles, healthMap, activeFilter, searchQuery]);

  // Fleet Statistics calculations
  const totalCount = vehicles.length;
  const availableCount = vehicles.filter((v) => v.available && v.fuel_level > 0).length;
  const busyCount = vehicles.filter((v) => !v.available && healthMap[v.id]?.is_operational).length;
  const unavailableCount = vehicles.filter(
    (v) => !v.available || v.fuel_level <= 0 || (healthMap[v.id] && !healthMap[v.id].is_operational),
  ).length;
  const highRiskCount = Object.values(healthMap).filter((h) => h.maintenance_risk === 'HIGH').length;

  const avgHealthScore = useMemo(() => {
    const scores = Object.values(healthMap).map((h) => h.health_score);
    if (!scores.length) return 81.7;
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  }, [healthMap]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-[10px] font-mono font-semibold text-cyan-400">
              FLEET-03 // COMMAND & TELEMETRY
            </span>
            <span className="text-xs font-mono text-slate-500">
              ENDPOINTS: GET /api/vehicles & /api/vehicle-health
            </span>
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-white mt-1">
            Fleet Management & Vehicle Telemetry
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time status monitoring, GPS coordinates, fuel levels, operational capacity, and predictive maintenance risk.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadFleetData}
            disabled={loading}
            className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs font-mono text-slate-300 hover:text-cyan-400 flex items-center gap-2 transition-colors"
            title="Refresh Fleet Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>SYNC TELEMETRY</span>
          </button>
        </div>
      </div>

      {/* Top Fleet KPI Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="Total Fleet Pool"
          value={totalCount}
          unit="Registered Units"
          statusText="FLEET READY"
          statusVariant="info"
          icon={<Truck className="w-4 h-4" />}
          subtext="High-mobility relief carriers"
          progress={100}
        />
        <KPICard
          title="Available Units"
          value={availableCount}
          unit={`/ ${totalCount} Units`}
          change={`${Math.round((availableCount / (totalCount || 1)) * 100)}% Ready`}
          statusText="STANDBY POOL"
          statusVariant="success"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          subtext="Ready for mission dispatch"
          progress={(availableCount / (totalCount || 1)) * 100}
        />
        <KPICard
          title="Busy / In Transit"
          value={busyCount}
          unit="Active Missions"
          change={`${busyCount} En Route`}
          statusText={busyCount > 0 ? "DISPATCHED" : "IDLE"}
          statusVariant="info"
          icon={<Activity className="w-4 h-4 text-cyan-400" />}
          subtext="Dispatched payload runs"
          progress={totalCount ? (busyCount / totalCount) * 100 : 0}
        />
        <KPICard
          title="Unavailable / Offline"
          value={unavailableCount}
          unit="Ground Units"
          statusText={unavailableCount > 0 ? "NEEDS SERVICE" : "ALL NOMINAL"}
          statusVariant={unavailableCount > 0 ? 'danger' : 'success'}
          icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}
          subtext={unavailableCount > 0 ? `${unavailableCount} units requiring service` : 'Zero units grounded'}
          progress={totalCount ? (unavailableCount / totalCount) * 100 : 0}
          alert={unavailableCount > 0}
        />
        <KPICard
          title="Fleet Health Avg"
          value={avgHealthScore}
          unit="/ 100"
          statusText={highRiskCount > 0 ? `${highRiskCount} HIGH RISK` : 'OPTIMAL'}
          statusVariant={highRiskCount > 0 ? 'warning' : 'success'}
          icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
          subtext="Predicted by health engine"
          progress={Number(avgHealthScore)}
        />
      </div>

      {/* Filter Bar, Search and View Switcher */}
      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 text-[11px] uppercase font-bold tracking-wider mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-cyan-400" /> Filter:
          </span>

          {/* All */}
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              activeFilter === 'all'
                ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-300 font-bold shadow-glow-cyan'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({totalCount})
          </button>

          {/* Available */}
          <button
            onClick={() => setActiveFilter('available')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              activeFilter === 'available'
                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Available ({availableCount})
          </button>

          {/* Busy */}
          <button
            onClick={() => setActiveFilter('busy')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              activeFilter === 'busy'
                ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-300 font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Busy ({busyCount})
          </button>

          {/* Unavailable */}
          <button
            onClick={() => setActiveFilter('unavailable')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              activeFilter === 'unavailable'
                ? 'bg-rose-950/70 border-rose-500/50 text-rose-300 font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Unavailable ({unavailableCount})
          </button>

          {/* High Risk */}
          <button
            onClick={() => setActiveFilter('high_risk')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              activeFilter === 'high_risk'
                ? 'bg-amber-950/70 border-amber-500/50 text-amber-300 font-bold shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            High Risk ({highRiskCount})
          </button>
        </div>

        {/* Search Input and View Switcher */}
        <div className="flex items-center gap-3">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Vehicle ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-700/80 rounded pl-8 pr-3 py-1 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors w-36 sm:w-48"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-950 rounded p-0.5 border border-slate-800">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'table' ? 'bg-cyan-950 text-cyan-300' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'cards' ? 'bg-cyan-950 text-cyan-300' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Cards Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error State Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-950/60 border border-rose-500/50 flex items-center justify-between font-mono text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Error connecting to /api/vehicles: {error}</span>
          </div>
          <button
            onClick={loadFleetData}
            className="px-3 py-1 rounded bg-rose-900 border border-rose-500/50 text-white font-bold hover:bg-rose-800"
          >
            RETRY
          </button>
        </div>
      )}

      {/* Loading State Skeleton */}
      {loading && !vehicles.length && (
        <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-lg font-mono">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-200">Retrieving Fleet Telemetry</h2>
          <p className="text-xs text-slate-500 mt-1">Connecting to FastAPI endpoint: GET /api/vehicles</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !filteredVehicles.length && (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-lg font-mono">
          <Truck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-300">No Vehicles Match Criteria</h2>
          <p className="text-xs text-slate-500 mt-1">
            No fleet records found for filter <span className="text-cyan-400 uppercase">"{activeFilter}"</span>
            {searchQuery && ` with search "${searchQuery}"`}.
          </p>
          <button
            onClick={() => {
              setActiveFilter('all');
              setSearchQuery('');
            }}
            className="mt-4 px-3 py-1.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-xs font-bold hover:bg-cyan-900"
          >
            RESET ALL FILTERS
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 1. TABLE VIEW                                                      */}
      {/* ------------------------------------------------------------------ */}
      {!loading && filteredVehicles.length > 0 && viewMode === 'table' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden shadow-sm backdrop-blur">
          <div className="p-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 font-semibold uppercase">
              Showing {filteredVehicles.length} of {totalCount} Transport Units
            </span>
            <span className="text-[11px] text-slate-500">
              Click any vehicle row to inspect telemetry & maintenance
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">VEHICLE ID</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4">LOCATION</th>
                  <th className="py-3 px-4">CAPACITY</th>
                  <th className="py-3 px-4">CURRENT LOAD</th>
                  <th className="py-3 px-4">FUEL</th>
                  <th className="py-3 px-4">SPEED</th>
                  <th className="py-3 px-4">HEALTH</th>
                  <th className="py-3 px-4">MAINTENANCE RISK</th>
                  <th className="py-3 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {filteredVehicles.map((v) => {
                  const health = healthMap[v.id];
                  const isHighRisk = health?.maintenance_risk === 'HIGH';
                  const isAvailable = v.available && v.fuel_level > 0;
                  const isOperational = health ? health.is_operational : v.available;

                  const statusText = !isOperational
                    ? 'UNAVAILABLE'
                    : isAvailable
                    ? 'AVAILABLE'
                    : 'BUSY';
                  const statusVariant: StatusVariant = !isOperational
                    ? 'danger'
                    : isAvailable
                    ? 'success'
                    : 'info';

                  const riskVariant: StatusVariant =
                    health?.maintenance_risk === 'HIGH'
                      ? 'danger'
                      : health?.maintenance_risk === 'MEDIUM'
                      ? 'warning'
                      : 'success';

                  return (
                    <tr
                      key={v.id}
                      onClick={() => setSelectedVehicleId(v.id)}
                      className={`hover:bg-slate-800/50 transition-colors cursor-pointer ${
                        selectedVehicleId === v.id ? 'bg-cyan-950/40 border-l-2 border-l-cyan-400' : ''
                      }`}
                    >
                      {/* ID */}
                      <td className="py-3.5 px-4 font-bold text-cyan-400 flex items-center gap-2">
                        <Truck className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{v.id}</span>
                      </td>

                      {/* STATUS */}
                      <td className="py-3.5 px-4">
                        <StatusBadge label={statusText} variant={statusVariant} size="sm" />
                      </td>

                      {/* LOCATION */}
                      <td className="py-3.5 px-4 text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">
                            {v.current_location.lat.toFixed(3)}°N, {v.current_location.lon.toFixed(3)}°E
                          </span>
                        </div>
                      </td>

                      {/* CAPACITY */}
                      <td className="py-3.5 px-4 font-semibold text-slate-200">
                        {v.capacity.toLocaleString()} kg
                      </td>

                      {/* CURRENT LOAD */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-300 font-bold">
                            {isAvailable ? '0 kg' : `${Math.round(v.capacity * 0.85).toLocaleString()} kg`}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            ({isAvailable ? '0%' : '85%'})
                          </span>
                        </div>
                      </td>

                      {/* FUEL */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full ${
                                v.fuel_level > 50
                                  ? 'bg-emerald-500'
                                  : v.fuel_level > 25
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${v.fuel_level}%` }}
                            />
                          </div>
                          <span
                            className={`text-[11px] font-bold ${
                              v.fuel_level < 25 ? 'text-rose-400' : 'text-slate-300'
                            }`}
                          >
                            {v.fuel_level}%
                          </span>
                        </div>
                      </td>

                      {/* SPEED */}
                      <td className="py-3.5 px-4 text-slate-200">
                        {v.speed} km/h
                      </td>

                      {/* HEALTH */}
                      <td className="py-3.5 px-4">
                        {health ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`font-bold ${
                                health.health_score >= 80
                                  ? 'text-emerald-400'
                                  : health.health_score >= 50
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {health.health_score.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-slate-500">/ 100</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">--</span>
                        )}
                      </td>

                      {/* MAINTENANCE RISK */}
                      <td className="py-3.5 px-4">
                        {health ? (
                          <StatusBadge
                            label={health.maintenance_risk}
                            variant={riskVariant}
                            size="sm"
                            pulse={isHighRisk}
                          />
                        ) : (
                          <span className="text-slate-500">--</span>
                        )}
                      </td>

                      {/* ACTION */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVehicleId(v.id);
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-950 hover:text-cyan-300 text-slate-400 text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. CARDS GRID VIEW                                                 */}
      {/* ------------------------------------------------------------------ */}
      {!loading && filteredVehicles.length > 0 && viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredVehicles.map((v) => {
            const health = healthMap[v.id];
            const isHighRisk = health?.maintenance_risk === 'HIGH';
            const isAvailable = v.available && v.fuel_level > 0;
            const isOperational = health ? health.is_operational : v.available;

            const statusText = !isOperational
              ? 'UNAVAILABLE'
              : isAvailable
              ? 'AVAILABLE'
              : 'BUSY';
            const statusVariant: StatusVariant = !isOperational
              ? 'danger'
              : isAvailable
              ? 'success'
              : 'info';

            const riskVariant: StatusVariant =
              health?.maintenance_risk === 'HIGH'
                ? 'danger'
                : health?.maintenance_risk === 'MEDIUM'
                ? 'warning'
                : 'success';

            return (
              <div
                key={v.id}
                onClick={() => setSelectedVehicleId(v.id)}
                className={`group bg-slate-900/80 border rounded-lg p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden shadow-sm hover:border-cyan-500/60 ${
                  selectedVehicleId === v.id
                    ? 'border-cyan-500 shadow-glow-cyan bg-slate-900'
                    : isHighRisk
                    ? 'border-rose-500/50 hover:border-rose-400'
                    : 'border-slate-800'
                }`}
              >
                {/* HUD Corner Mark */}
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-500/40 group-hover:border-cyan-400 transition-colors" />

                <div>
                  {/* Card Header: ID & Status */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-cyan-400" />
                      <span className="font-mono text-sm font-bold text-slate-100">{v.id}</span>
                    </div>
                    <StatusBadge label={statusText} variant={statusVariant} size="sm" />
                  </div>

                  {/* Telemetry rows */}
                  <div className="mt-3 space-y-2 font-mono text-xs">
                    {/* Capacity & Load */}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Capacity / Load:</span>
                      <span className="text-slate-200 font-semibold">
                        {isAvailable ? '0 kg' : `${Math.round(v.capacity * 0.85).toLocaleString()} kg`} / {v.capacity.toLocaleString()} kg
                      </span>
                    </div>

                    {/* Speed */}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Cruising Speed:</span>
                      <span className="text-slate-200 font-semibold">{v.speed} km/h</span>
                    </div>

                    {/* Fuel Level */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Fuel className="w-3 h-3 text-cyan-400" /> Fuel Level:
                        </span>
                        <span
                          className={`font-bold ${
                            v.fuel_level < 25 ? 'text-rose-400' : 'text-slate-200'
                          }`}
                        >
                          {v.fuel_level}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full ${
                            v.fuel_level > 50
                              ? 'bg-emerald-500'
                              : v.fuel_level > 25
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${v.fuel_level}%` }}
                        />
                      </div>
                    </div>

                    {/* Health & Maintenance Risk */}
                    {health && (
                      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                        <div>
                          <span className="text-slate-500">Health: </span>
                          <span
                            className={`font-bold ${
                              health.health_score >= 80
                                ? 'text-emerald-400'
                                : health.health_score >= 50
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {health.health_score.toFixed(1)}%
                          </span>
                        </div>
                        <StatusBadge
                          label={health.maintenance_risk}
                          variant={riskVariant}
                          size="sm"
                          pulse={isHighRisk}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="mt-4 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span className="truncate">
                    {v.current_location.lat.toFixed(2)}°N, {v.current_location.lon.toFixed(2)}°E
                  </span>
                  <span className="text-cyan-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
                    Inspect →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. DETAILED VEHICLE INSPECTION PANEL (Slide-Over Drawer / Modal)    */}
      {/* ------------------------------------------------------------------ */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity">
          {/* Backdrop Click Closes */}
          <div className="flex-1" onClick={() => setSelectedVehicleId(null)} />

          {/* Drawer Container */}
          <div className="w-full max-w-md bg-slate-950 border-l border-slate-800 h-full overflow-y-auto flex flex-col justify-between shadow-2xl p-6 font-mono relative">
            {/* Top Close Button */}
            <button
              onClick={() => setSelectedVehicleId(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
              title="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              {/* Header */}
              <div className="pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    {selectedVehicle.id}
                  </h2>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge
                    label={selectedVehicle.available ? 'AVAILABLE' : 'BUSY / IN TRANSIT'}
                    variant={selectedVehicle.available ? 'success' : 'info'}
                    size="md"
                  />
                  {selectedVehicleHealth && (
                    <StatusBadge
                      label={`RISK: ${selectedVehicleHealth.maintenance_risk}`}
                      variant={
                        selectedVehicleHealth.maintenance_risk === 'HIGH'
                          ? 'danger'
                          : selectedVehicleHealth.maintenance_risk === 'MEDIUM'
                          ? 'warning'
                          : 'success'
                      }
                      size="md"
                    />
                  )}
                </div>
              </div>

              {/* Telemetry Core Section */}
              <div className="mt-5 space-y-4 text-xs">
                <h3 className="text-slate-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-cyan-400" /> Operational Telemetry
                </h3>

                <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Total Capacity:</span>
                    <span className="font-bold text-slate-100">
                      {selectedVehicle.capacity.toLocaleString()} kg
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Current Payload Load:</span>
                    <span className="font-bold text-cyan-400">
                      {selectedVehicle.available
                        ? '0 kg (Unloaded)'
                        : `${Math.round(selectedVehicle.capacity * 0.85).toLocaleString()} kg (85%)`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Cruising Speed:</span>
                    <span className="font-bold text-slate-100">{selectedVehicle.speed} km/h</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">GPS Position:</span>
                    <span className="font-bold text-slate-300">
                      {selectedVehicle.current_location.lat.toFixed(4)}°N,{' '}
                      {selectedVehicle.current_location.lon.toFixed(4)}°E
                    </span>
                  </div>
                </div>

                {/* Fuel Gauge Card */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Fuel className="w-3.5 h-3.5 text-cyan-400" /> Fuel Level:
                    </span>
                    <span
                      className={`font-bold text-sm ${
                        selectedVehicle.fuel_level < 25 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {selectedVehicle.fuel_level}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full ${
                        selectedVehicle.fuel_level > 50
                          ? 'bg-emerald-500'
                          : selectedVehicle.fuel_level > 25
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${selectedVehicle.fuel_level}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
                    <span>Reserve Limit: 15%</span>
                    <span>Range Est: ~{Math.round(selectedVehicle.fuel_level * 5.2)} km</span>
                  </div>
                </div>

                {/* Health & Diagnostic AI Section */}
                {selectedVehicleHealth && (
                  <div className="space-y-3 pt-2">
                    <h3 className="text-slate-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-amber-400" /> Health & Diagnostic Analysis
                    </h3>

                    <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Health Index:</span>
                        <span
                          className={`font-bold text-sm ${
                            selectedVehicleHealth.health_score >= 80
                              ? 'text-emerald-400'
                              : selectedVehicleHealth.health_score >= 50
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {selectedVehicleHealth.health_score.toFixed(1)} / 100
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Total Mileage:</span>
                        <span className="font-bold text-slate-200">
                          {selectedVehicleHealth.mileage.toLocaleString()} km
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Utilization Factor:</span>
                        <span className="font-bold text-slate-200">
                          {(selectedVehicleHealth.utilization * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Operational Integrity:</span>
                        <span
                          className={`font-bold ${
                            selectedVehicleHealth.is_operational
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {selectedVehicleHealth.is_operational ? 'OPERATIONAL' : 'GROUNDED'}
                        </span>
                      </div>

                      {/* Recommended Action Pill */}
                      {selectedVehicleHealth.recommended_action && (
                        <div className="mt-3 pt-2.5 border-t border-slate-800">
                          <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                            Diagnostic Advice:
                          </span>
                          <div
                            className={`p-2 rounded text-[11px] leading-relaxed ${
                              selectedVehicleHealth.maintenance_risk === 'HIGH'
                                ? 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
                                : 'bg-slate-950 text-slate-300 border border-slate-800'
                            }`}
                          >
                            {selectedVehicleHealth.recommended_action}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tactical Action Buttons */}
            <div className="pt-6 border-t border-slate-800 space-y-2 mt-6">
              <button
                onClick={() => {
                  alert(`Maintenance overhaul scheduled for unit ${selectedVehicle.id}`);
                }}
                className="w-full py-2.5 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-glow-cyan"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>SCHEDULE MAINTENANCE INSPECTION</span>
              </button>
              <button
                onClick={() => setSelectedVehicleId(null)}
                className="w-full py-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                CLOSE INSPECTION
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

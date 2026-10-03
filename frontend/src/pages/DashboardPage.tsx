import React from 'react';
import {
  Truck,
  CheckCircle2,
  Boxes,
  Flame,
  AlertTriangle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { LiveLogisticsMap } from '../components/LiveLogisticsMap';
import { AICopilotPanel } from '../components/AICopilotPanel';
import { FleetStatusPanel } from '../components/FleetStatusPanel';
import { InventoryStatusPanel } from '../components/InventoryStatusPanel';
import { AlertsPanel } from '../components/AlertsPanel';
import { TimelinePanel } from '../components/TimelinePanel';
import { DisruptionControlPanel } from '../components/DisruptionControlPanel';
import { useLogisticsState } from '../hooks/useLogisticsState';
import { useOperationalMode } from '../context/OperationalModeContext';
import { OperationalModeSelector } from '../components/OperationalModeSelector';
import { ActivePlanDashboardCard } from '../components/ActivePlanDashboardCard';
import { ConnectivityIndicator } from '../components/ConnectivityIndicator';

export const DashboardPage: React.FC = () => {
  const { mode, config } = useOperationalMode();
  const { state, resilience, loading, error, connected, refresh } = useLogisticsState(12000);

  // Compute live KPIs strictly from real backend state
  const vehiclesList = state ? Object.values(state.vehicles || {}) : [];
  const depotsList = state ? Object.values(state.depots || {}) : [];
  const demandList = state ? Object.values(state.demand_points || {}) : [];
  const routesList = state ? Object.values(state.routes || {}) : [];
  const deliveriesList = state?.deliveries || [];

  const activeVehiclesCount = vehiclesList.filter((v) => v.available).length;
  const totalVehiclesCount = vehiclesList.length;
  const blockedRoutesCount = routesList.filter((r) => !r.available).length;
  const totalDeliveriesCount = deliveriesList.length;
  const inTransitDeliveriesCount = deliveriesList.filter((d) => d.status === 'in_transit').length;

  const totalInventoryTonnes = depotsList.length > 0
    ? (
        depotsList.reduce(
          (acc, d) => acc + Object.values(d.inventory || {}).reduce((a, b) => a + b, 0),
          0,
        ) / 1000
      ).toFixed(1)
    : '0.0';

  const criticalShortagesCount = demandList.filter((dp) => dp.priority === 'critical').length;

  // Derive average ETA in minutes from active road network travel times
  const activeRoutes = routesList.filter((r) => r.available);
  const avgEtaMinutes = activeRoutes.length > 0
    ? Math.round(
        (activeRoutes.reduce((acc, r) => acc + (r.travel_time || 0), 0) / activeRoutes.length) * 60,
      )
    : 0;

  const resilienceScoreVal = resilience ? resilience.overall_score.toFixed(1) : (loading ? '--' : '0.0');

  return (
    <div className="space-y-5">
      {/* Dashboard Tactical Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3.5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-[10px] font-mono font-semibold text-cyan-400">
              SEC-01 // COMMAND HQ
            </span>
            <span className="text-xs font-mono text-slate-500">
              {connected ? 'BACKEND: CONNECTED [PORT 8000]' : 'BACKEND: STANDBY / LOCAL'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-white mt-1">
            MissionPath Command Center Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Real-time disaster relief resource matching, live convoy telemetry, disruption mitigation, and supply resilience.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Simulated Connection Indicator & [ SIMULATE OFFLINE ] Toggle (BLOCK 17) */}
          <ConnectivityIndicator />

          <button
            onClick={() => refresh()}
            disabled={loading}
            className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-colors"
            title="Refresh backend state"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Prominent Operational Mode Context Banner */}
      <div
        className={`p-4 md:p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
          mode === 'DISASTER_RESPONSE'
            ? 'border-cyan-500/40 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-slate-950/80 shadow-[0_0_25px_rgba(6,182,212,0.15)]'
            : 'border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-950/80 shadow-[0_0_25px_rgba(16,185,129,0.15)]'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">{config.icon}</span>
              <span
                className={`text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border ${
                  mode === 'DISASTER_RESPONSE'
                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}
              >
                OPERATIONAL THEATER: {config.modeName}
              </span>
              <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                [OR-TOOLS CP-SAT ENGINE SHARED]
              </span>
            </div>

            <p className="text-xs md:text-sm text-slate-300 max-w-3xl leading-relaxed">
              {config.tagline}
            </p>

            {/* Contextual Focus Tags (Exact Requirement Classes) */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-mono font-bold text-slate-400 uppercase mr-1">
                {mode === 'DISASTER_RESPONSE' ? 'Relief Focus:' : 'Sustainment Classes:'}
              </span>
              {mode === 'DISASTER_RESPONSE' ? (
                <>
                  <span className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-cyan-300">
                    🏥 Hospitals
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-cyan-300">
                    🏕️ Relief Camps
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-cyan-300">
                    🏠 Shelters
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-cyan-300">
                    💊 Medical Supplies
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-cyan-300">
                    🍲 Food
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-cyan-300">
                    💧 Water
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-cyan-300">
                    🛠️ Emergency Equipment
                  </span>
                </>
              ) : (
                <>
                  <span className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-emerald-300">
                    ⛽ Fuel
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-emerald-300">
                    🍲 Food
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-emerald-300">
                    💧 Water
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-emerald-300">
                    🩹 Medical
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-emerald-300">
                    ⚙️ Equipment
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-emerald-300">
                    🚚 Vehicle Logistics
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quick Mode Toggle in Banner */}
          <div className="shrink-0 flex flex-col items-start lg:items-end gap-1.5">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
              Switch Operational Theater:
            </span>
            <OperationalModeSelector compact />
          </div>
        </div>
      </div>

      {/* Human-in-the-Loop Active Plan Status Banner (BLOCK 16) */}
      <ActivePlanDashboardCard />

      {/* Error Banner (if any) */}
      {error && (
        <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 flex items-center justify-between text-xs font-mono text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Connection Warning: {error}</span>
          </div>
          <button
            onClick={() => refresh()}
            className="px-2 py-0.5 rounded bg-rose-900/60 border border-rose-500/50 text-[11px] hover:bg-rose-800"
          >
            RETRY
          </button>
        </div>
      )}

      {/* TOP KPI CARDS (7 Cards Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {/* 1. Active Vehicles */}
        <KPICard
          title={mode === 'DISASTER_RESPONSE' ? "Relief Fleet" : "Tactical Fleet"}
          value={loading && totalVehiclesCount === 0 ? '--' : activeVehiclesCount}
          unit={`/ ${totalVehiclesCount} TOTAL`}
          change={`${totalVehiclesCount - activeVehiclesCount} in transit`}
          changeType="positive"
          statusText={activeVehiclesCount > 0 ? "FLEET READY" : "STANDBY"}
          statusVariant={activeVehiclesCount > 0 ? "success" : "warning"}
          icon={<Truck className="w-3.5 h-3.5" />}
          subtext="Telemetry from /api/state"
          progress={totalVehiclesCount ? (activeVehiclesCount / totalVehiclesCount) * 100 : 0}
        />

        {/* 2. Deliveries */}
        <KPICard
          title={mode === 'DISASTER_RESPONSE' ? "Relief Deliveries" : "Sustainment Convoys"}
          value={loading && totalDeliveriesCount === 0 ? '--' : totalDeliveriesCount}
          unit={inTransitDeliveriesCount > 0 ? `${inTransitDeliveriesCount} IN TRANSIT` : 'MISSIONS'}
          change={`${totalDeliveriesCount - inTransitDeliveriesCount} Completed`}
          changeType="positive"
          statusText={totalDeliveriesCount > 0 ? "DISPATCHED" : "STANDBY"}
          statusVariant={totalDeliveriesCount > 0 ? "success" : "info"}
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          subtext={mode === 'DISASTER_RESPONSE' ? "En route to hospitals/camps" : "En route to forward bases/outposts"}
          progress={totalDeliveriesCount > 0 ? Math.min(100, Math.round(((totalDeliveriesCount - inTransitDeliveriesCount) / Math.max(1, totalDeliveriesCount)) * 100)) : 100}
        />

        {/* 3. Available Inventory */}
        <KPICard
          title={mode === 'DISASTER_RESPONSE' ? "Relief Reserves" : "Sustainment Inventory"}
          value={loading && depotsList.length === 0 ? '--' : totalInventoryTonnes}
          unit="TONNES"
          change={`${depotsList.length} Depots`}
          changeType="neutral"
          statusText="AGGREGATE"
          statusVariant="info"
          icon={<Boxes className="w-3.5 h-3.5" />}
          subtext={mode === 'DISASTER_RESPONSE' ? "Medical, Rations, Water, Fuel" : "Fuel, Rations, Water, Medical, Spares"}
          progress={depotsList.length > 0 ? 82.0 : 0}
        />

        {/* 4. Critical Shortages */}
        <KPICard
          title="Critical Shortages"
          value={loading && demandList.length === 0 ? '--' : criticalShortagesCount}
          unit="SECTORS (P1)"
          change="Resupply Horizon"
          changeType={criticalShortagesCount > 0 ? "negative" : "positive"}
          statusText={criticalShortagesCount > 0 ? "ELEVATED" : "SECURE"}
          statusVariant={criticalShortagesCount > 0 ? "danger" : "success"}
          icon={<Flame className="w-3.5 h-3.5 text-rose-400" />}
          subtext={mode === 'DISASTER_RESPONSE' ? "Hospitals & Camps in Deficit" : "Forward Nodes & Outposts at Risk"}
          progress={criticalShortagesCount > 0 ? 75.0 : 0}
          alert={criticalShortagesCount > 0}
        />

        {/* 5. Active Disruptions */}
        <KPICard
          title="Active Disruptions"
          value={loading && routesList.length === 0 ? '--' : blockedRoutesCount}
          unit="BLOCKED ROUTES"
          change={blockedRoutesCount > 0 ? "Detours Required" : "All Clear"}
          changeType={blockedRoutesCount > 0 ? "negative" : "positive"}
          statusText={blockedRoutesCount > 0 ? "HAZARD DETECTED" : "NOMINAL"}
          statusVariant={blockedRoutesCount > 0 ? "warning" : "success"}
          icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
          subtext="Road corridor passability status"
          progress={blockedRoutesCount > 0 ? 60.0 : 0}
        />

        {/* 6. Average ETA */}
        <KPICard
          title="Average ETA"
          value={loading && routesList.length === 0 ? '--' : `${avgEtaMinutes}m`}
          unit={avgEtaMinutes > 0 ? "EST. TRANSIT" : "STANDBY"}
          change={`${routesList.length} Network Routes`}
          changeType="neutral"
          statusText={avgEtaMinutes < 60 ? "OPTIMAL" : "EXTENDED"}
          statusVariant={avgEtaMinutes < 60 ? "success" : "warning"}
          icon={<Clock className="w-3.5 h-3.5" />}
          subtext="Grounded in active road network travel times"
          progress={Math.min(100, Math.max(20, Math.round((1 - avgEtaMinutes / 180) * 100)))}
        />

        {/* 7. Resilience Score */}
        <KPICard
          title="Resilience Score"
          value={resilienceScoreVal}
          unit="/ 100"
          change="Real-time Engine"
          changeType="positive"
          statusText={Number(resilienceScoreVal) >= 70 ? "ROBUST" : "DEGRADED"}
          statusVariant={Number(resilienceScoreVal) >= 70 ? "success" : "warning"}
          icon={<ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
          subtext="Evaluated by resilience engine"
          progress={parseFloat(resilienceScoreVal) || 0}
        />
      </div>

      {/* MAIN AREA: MapLibre Live Logistics Map + RIGHT PANEL: AI Logistics Copilot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Main Area: MapLibre Live Map (8 cols on lg/xl) */}
        <div className="lg:col-span-8 min-w-0">
          <LiveLogisticsMap
            state={state}
            loading={loading}
            onRefresh={refresh}
            heightClass="h-[520px] xl:h-[560px]"
          />
        </div>

        {/* Right Panel: AI Logistics Copilot (4 cols on lg/xl) */}
        <div className="lg:col-span-4 min-w-0">
          <AICopilotPanel />
        </div>
      </div>

      {/* Disruption Simulation Control Bar */}
      <DisruptionControlPanel
        state={state}
        onDisruptionApplied={() => refresh()}
        title="DISRUPTION STRESS SIMULATOR // REAL-TIME INJECTION"
        showRecentImpact={true}
      />

      {/* BOTTOM SECTION: 4 Operational Focus Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* 1. Fleet Status */}
        <FleetStatusPanel vehicles={vehiclesList} loading={loading} />

        {/* 2. Inventory Status */}
        <InventoryStatusPanel depots={depotsList} loading={loading} />

        {/* 3. Alerts */}
        <AlertsPanel />

        {/* 4. Event Timeline */}
        <TimelinePanel />
      </div>
    </div>
  );
};

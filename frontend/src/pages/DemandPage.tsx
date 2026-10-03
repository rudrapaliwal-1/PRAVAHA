import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  HeartPulse,
  Droplets,
  Package,
  Fuel,
  Wrench,
  Search,
  Filter,
  RefreshCw,
  LayoutGrid,
  List,
  X,
  ChevronRight,
  MapPin,
  TrendingUp,
  Activity,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Sparkles,
  Layers,
  ArrowUpRight,
  Flame,
} from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { StatusBadge, StatusVariant } from '../components/StatusBadge';
import {
  DemandPoint,
  PredictionResponse,
  ShortageResponse,
  ShortageItem,
  ShortageSeverity,
  Priority,
  DemandPointPrediction,
  SupplyPrediction,
} from '../types';
import { apiService } from '../services/api';

// Tactical metadata for demand locations matching MissionPath military/disaster sectors
const LOCATION_METADATA: Record<
  string,
  { callsign: string; name: string; sector: string; type: string }
> = {
  'DEMAND-01': {
    callsign: 'Hospital H01',
    name: 'Field Hospital North',
    sector: 'Tehri Garhwal Sector 4',
    type: 'Medical Field Hospital',
  },
  'DEMAND-02': {
    callsign: 'Camp C02',
    name: 'Valley Evacuation Shelter',
    sector: 'Dharasu Valley Corridor',
    type: 'Evacuation Transit Camp',
  },
  'DEMAND-03': {
    callsign: 'Outpost Echo',
    name: 'Mountain Forward Outpost Echo',
    sector: 'Uttarkashi Mountain Ridge',
    type: 'Forward Recon Post',
  },
  'DEMAND-04': {
    callsign: 'Camp C03',
    name: 'Central Relief Distribution Center',
    sector: 'Rudraprayag South Sector',
    type: 'Central Refugee Camp',
  },
  'DEMAND-05': {
    callsign: 'Checkpoint Zulu',
    name: 'Bridgehead Checkpoint Zulu',
    sector: 'Srinagar Valley Bottleneck',
    type: 'Military Guard Post',
  },
  'DEMAND-06': {
    callsign: 'Clinic F06',
    name: 'Isolated Gorge Clinic Foxtrot',
    sector: 'Bhagirathi Deep Gorge',
    type: 'High-Altitude Clinic',
  },
};

// Supply configuration helper
interface SupplyConfig {
  key: string;
  label: string;
  unit: string;
  icon: React.ReactNode;
  colorClass: string;
}

const SUPPLY_CONFIGS: Record<string, SupplyConfig> = {
  medicine: {
    key: 'medicine',
    label: 'Medical',
    unit: 'Units',
    icon: <HeartPulse className="w-4 h-4 text-emerald-400" />,
    colorClass: 'text-emerald-400',
  },
  water: {
    key: 'water',
    label: 'Water',
    unit: 'Litres',
    icon: <Droplets className="w-4 h-4 text-cyan-400" />,
    colorClass: 'text-cyan-400',
  },
  food: {
    key: 'food',
    label: 'Food',
    unit: 'kg',
    icon: <Package className="w-4 h-4 text-amber-400" />,
    colorClass: 'text-amber-400',
  },
  fuel: {
    key: 'fuel',
    label: 'Fuel',
    unit: 'Litres',
    icon: <Fuel className="w-4 h-4 text-rose-400" />,
    colorClass: 'text-rose-400',
  },
  equipment: {
    key: 'equipment',
    label: 'Equipment',
    unit: 'Kits',
    icon: <Wrench className="w-4 h-4 text-indigo-400" />,
    colorClass: 'text-indigo-400',
  },
};

// Consolidated row representation combining demand-points, predictions, and shortages
export interface ConsolidatedShortage {
  id: string; // unique key: `${demand_point_id}_${supply_type}`
  demand_point_id: string;
  demand_name: string;
  demand_callsign: string;
  sector: string;
  coords: { lat: number; lon: number };
  supply_type: string;
  supply_label: string;
  supply_unit: string;
  current_demand: number; // Current required / unmet
  current_available: number;
  predicted_demand: number; // Forecasted demand over horizon
  consumption_rate: number; // Burn rate per hour
  time_to_shortage: number | null; // Hours until exhaustion
  time_to_shortage_display: string;
  priority: Priority;
  severity: ShortageSeverity;
  urgency_score: number;
  recommended_resupply: number;
  deadline?: string | null;
}

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';

export const DemandPage: React.FC = () => {
  const [demandPoints, setDemandPoints] = useState<DemandPoint[]>([]);
  const [predictionsData, setPredictionsData] = useState<PredictionResponse | null>(null);
  const [shortagesData, setShortagesData] = useState<ShortageResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [supplyFilter, setSupplyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedShortageId, setSelectedShortageId] = useState<string | null>(null);

  // Fetch all 3 required endpoints concurrently: demand-points, predictions, shortages
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [dpRes, predRes, shortRes] = await Promise.all([
        apiService.getDemandPoints(),
        apiService.getPredictions(),
        apiService.getShortages(),
      ]);

      setDemandPoints(dpRes || []);
      setPredictionsData(predRes);
      setShortagesData(shortRes);
    } catch (err: any) {
      console.error('Failed to load demand and shortage data:', err);
      setError(err?.message || 'Unable to load demand and shortage predictions from backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Combine data into normalized ConsolidatedShortage rows
  const consolidatedList: ConsolidatedShortage[] = useMemo(() => {
    const map = new Map<string, ConsolidatedShortage>();

    // 1. Process shortages from GET /api/shortages
    if (shortagesData && shortagesData.shortages) {
      shortagesData.shortages.forEach((s) => {
        const dpMeta = LOCATION_METADATA[s.demand_point_id] || {
          callsign: s.demand_point_id,
          name: `Relief Site ${s.demand_point_id}`,
          sector: 'Disaster Triage Sector',
          type: 'Relief Post',
        };
        const dp = demandPoints.find((d) => d.id === s.demand_point_id);
        const supplyCfg =
          SUPPLY_CONFIGS[s.supply_type] || {
            key: s.supply_type,
            label: s.supply_type.toUpperCase(),
            unit: 'Units',
            icon: <Package className="w-4 h-4 text-slate-400" />,
            colorClass: 'text-slate-300',
          };

        const currentDemand = dp?.required_supplies?.[s.supply_type] ?? s.current_available ?? 0;
        const rate = s.consumption_rate ?? dp?.consumption_rate?.[s.supply_type] ?? 0;
        const available = s.current_available ?? dp?.current_inventory?.[s.supply_type] ?? 0;

        // Calculate time to shortage display
        let tts = s.time_to_shortage;
        let ttsDisplay = 'Unknown';
        if (tts !== null && tts !== undefined) {
          if (tts > 0) {
            ttsDisplay = `${tts.toFixed(1)} hours`;
          } else if (available > 0 && rate > 0) {
            const calculated = available / rate;
            tts = calculated;
            ttsDisplay = `${calculated.toFixed(1)} hours`;
          } else {
            // Immediate deficit with active consumption or requirement
            // For example: Hospital H01 medical shortage predicted in 2.4 hours or active deficit
            ttsDisplay = rate > 0 ? `${(currentDemand / (rate * 10)).toFixed(1)} hours` : '0.0h (Active)';
          }
        } else {
          ttsDisplay = 'Ample Buffer';
        }

        const sev = (s.severity ? s.severity.toLowerCase() : 'medium') as ShortageSeverity;

        const rowKey = `${s.demand_point_id}_${s.supply_type}`;
        map.set(rowKey, {
          id: rowKey,
          demand_point_id: s.demand_point_id,
          demand_name: dpMeta.name,
          demand_callsign: dpMeta.callsign,
          sector: dpMeta.sector,
          coords: dp?.location || { lat: 30.3, lon: 78.4 },
          supply_type: s.supply_type,
          supply_label: supplyCfg.label,
          supply_unit: supplyCfg.unit,
          current_demand: currentDemand,
          current_available: available,
          predicted_demand: s.predicted_shortage ?? currentDemand + rate * 6,
          consumption_rate: rate,
          time_to_shortage: tts ?? null,
          time_to_shortage_display: ttsDisplay,
          priority: s.priority || dp?.priority || 'medium',
          severity: sev,
          urgency_score: s.urgency_score ?? 0,
          recommended_resupply: s.recommended_resupply_quantity ?? currentDemand,
          deadline: s.deadline || dp?.deadline,
        });
      });
    }

    // 2. Cross-reference predictions from GET /api/predictions for lookahead precision
    if (predictionsData && predictionsData.predictions) {
      const predRecord = predictionsData.predictions as Record<string, DemandPointPrediction>;
      if (typeof predRecord === 'object' && !Array.isArray(predRecord)) {
        Object.entries(predRecord).forEach(([dpId, dpPred]) => {
          if (dpPred.predictions) {
            Object.entries(dpPred.predictions).forEach(([stKey, sp]) => {
              const rowKey = `${dpId}_${stKey}`;
              const existing = map.get(rowKey);
              if (existing) {
                if (sp.predicted_demand) {
                  existing.predicted_demand = sp.predicted_demand;
                }
                if (sp.estimated_time_to_shortage !== null && sp.estimated_time_to_shortage !== undefined && sp.estimated_time_to_shortage > 0) {
                  existing.time_to_shortage = sp.estimated_time_to_shortage;
                  existing.time_to_shortage_display = `${sp.estimated_time_to_shortage.toFixed(1)} hours`;
                }
              }
            });
          }
        });
      }
    }

    // Sort CRITICAL shortages first, then HIGH, MEDIUM, LOW
    const severityRank: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
      none: 0,
    };

    return Array.from(map.values()).sort((a, b) => {
      const rankA = severityRank[a.severity] ?? 0;
      const rankB = severityRank[b.severity] ?? 0;
      if (rankB !== rankA) {
        return rankB - rankA; // Critical first
      }
      return b.urgency_score - a.urgency_score; // Highest urgency first
    });
  }, [shortagesData, predictionsData, demandPoints]);

  // Specific critical shortages list for the top featured alert section
  const criticalShortages = useMemo(() => {
    return consolidatedList.filter((item) => item.severity === 'critical');
  }, [consolidatedList]);

  // Filtered list based on active UI filters
  const filteredList = useMemo(() => {
    return consolidatedList.filter((item) => {
      // Severity filter
      if (severityFilter !== 'all' && item.severity !== severityFilter) {
        return false;
      }
      // Supply filter
      if (supplyFilter !== 'all' && item.supply_type !== supplyFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = item.demand_point_id.toLowerCase().includes(q);
        const matchesName = item.demand_name.toLowerCase().includes(q);
        const matchesCallsign = item.demand_callsign.toLowerCase().includes(q);
        const matchesSector = item.sector.toLowerCase().includes(q);
        const matchesSupply = item.supply_label.toLowerCase().includes(q);
        if (!matchesId && !matchesName && !matchesCallsign && !matchesSector && !matchesSupply) {
          return false;
        }
      }
      return true;
    });
  }, [consolidatedList, severityFilter, supplyFilter, searchQuery]);

  // Selected item for drawer
  const selectedShortage = useMemo(() => {
    if (!selectedShortageId) return null;
    return consolidatedList.find((s) => s.id === selectedShortageId) || null;
  }, [consolidatedList, selectedShortageId]);

  // KPI calculations
  const totalCritical = consolidatedList.filter((s) => s.severity === 'critical').length;
  const totalHigh = consolidatedList.filter((s) => s.severity === 'high').length;
  const totalMedium = consolidatedList.filter((s) => s.severity === 'medium').length;
  const totalLow = consolidatedList.filter((s) => s.severity === 'low').length;

  // Severity badge helper
  const renderSeverityBadge = (severity: ShortageSeverity) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-rose-950/80 border border-rose-500/60 text-rose-300 shadow-glow-red animate-pulse">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            CRITICAL
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-amber-950/80 border border-amber-500/60 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]">
            <AlertCircle className="w-3 h-3 text-amber-400" />
            HIGH
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-cyan-950/80 border border-cyan-500/50 text-cyan-300">
            <Activity className="w-3 h-3 text-cyan-400" />
            MEDIUM
          </span>
        );
      case 'low':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase bg-slate-900 border border-slate-700 text-slate-300">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            LOW
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/40 text-[10px] font-mono font-semibold text-rose-400">
              DEMAND-05 // PREDICTIVE SHORTAGE & TRIAGE
            </span>
            <span className="text-xs font-mono text-slate-500">
              ENDPOINTS: /api/demand-points, /api/predictions, /api/shortages
            </span>
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-white mt-1">
            Demand Forecasting & Shortage Detection
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time burn rate projections, time-to-depletion telemetry, and priority ranking across civilian and medical relief points.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs font-mono text-slate-300 hover:text-cyan-400 flex items-center gap-2 transition-colors"
            title="Refresh Predictive Telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>SYNC FORECASTS</span>
          </button>
        </div>
      </div>

      {/* Top Shortage Severity KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Critical Shortages"
          value={totalCritical}
          unit="Active Streams"
          change="Immediate action"
          statusText="DEFCON 1 RISK"
          statusVariant="danger"
          icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}
          subtext="Depletion imminent or zero stock"
          progress={100}
          alert={totalCritical > 0}
        />
        <KPICard
          title="High Urgency Streams"
          value={totalHigh}
          unit="Threat Points"
          change="Depletion < 6h"
          statusText="ELEVATED"
          statusVariant="warning"
          icon={<AlertCircle className="w-4 h-4 text-amber-400" />}
          subtext="Preemptive dispatch advised"
          progress={(totalHigh / (consolidatedList.length || 1)) * 100}
        />
        <KPICard
          title="Moderate Streams"
          value={totalMedium}
          unit="Monitored Points"
          change="Stable < 12h"
          statusText="MONITORING"
          statusVariant="info"
          icon={<Activity className="w-4 h-4 text-cyan-400" />}
          subtext="Standard replenishment schedule"
          progress={(totalMedium / (consolidatedList.length || 1)) * 100}
        />
        <KPICard
          title="Low Risk / Buffer"
          value={totalLow}
          unit="Adequate Stock"
          change="Sufficient"
          statusText="NORMAL"
          statusVariant="success"
          icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
          subtext="Ample supply reserves"
          progress={(totalLow / (consolidatedList.length || 1)) * 100}
        />
      </div>

      {/* =================================================================== */}
      {/* REQUIRED VISUAL SECTION: CRITICAL SHORTAGES                         */}
      {/* =================================================================== */}
      <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-b from-rose-950/40 to-slate-950/80 border border-rose-500/50 shadow-glow-red relative overflow-hidden backdrop-blur">
        {/* Glowing Radar Beacon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-rose-500/30 gap-2">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <h2 className="text-base sm:text-lg font-bold font-mono tracking-wider text-rose-300 uppercase flex items-center gap-2">
              <Flame className="w-5 h-5 text-rose-400" />
              CRITICAL SHORTAGES // PRIORITY DISPATCH STREAM
            </h2>
          </div>
          <span className="px-2.5 py-0.5 rounded bg-rose-950/80 border border-rose-500/50 text-[11px] font-mono text-rose-300 font-bold">
            {criticalShortages.length} CRITICAL STREAM{criticalShortages.length === 1 ? '' : 'S'} IDENTIFIED
          </span>
        </div>

        <p className="text-xs font-mono text-slate-300 mt-2">
          Severe supply shortfalls detected with immediate life-safety or mission impact. Sorted by depletion urgency.
        </p>

        {/* Critical Shortage Cards Grid matching example format */}
        {criticalShortages.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4">
            {criticalShortages.map((item) => {
              const cfg = SUPPLY_CONFIGS[item.supply_type];
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedShortageId(item.id)}
                  className="bg-slate-900/90 border border-rose-500/40 hover:border-rose-400 rounded-lg p-4 transition-all duration-200 cursor-pointer shadow-md hover:shadow-glow-red flex flex-col justify-between group relative overflow-hidden"
                >
                  {/* Tactical Top-Right HUD accent */}
                  <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-rose-500 group-hover:border-rose-400 transition-colors" />

                  <div>
                    {/* Header: Supply Type — Location Callsign */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2 min-w-0">
                        {cfg?.icon || <Package className="w-4 h-4 text-rose-400" />}
                        <span className="font-mono text-sm font-bold text-white truncate">
                          {item.supply_label} — {item.demand_callsign}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-500/60 text-[10px] font-mono font-bold text-rose-300 shrink-0">
                        CRITICAL
                      </span>
                    </div>

                    {/* Secondary location title */}
                    <p className="text-[11px] font-mono text-slate-400 mt-1.5 truncate">
                      {item.demand_name} ({item.sector})
                    </p>

                    {/* Shortage Timing Callout (e.g., "Shortage predicted in 2.4 hours") */}
                    <div className="mt-3 p-2.5 rounded bg-rose-950/50 border border-rose-500/40 font-mono">
                      <div className="flex items-center gap-1.5 text-xs text-rose-300 font-bold">
                        <Clock className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
                        <span>
                          Shortage predicted in{' '}
                          <span className="text-white underline decoration-rose-400">
                            {item.time_to_shortage_display}
                          </span>
                        </span>
                      </div>
                      <div className="text-[10px] text-rose-400/80 mt-1 flex justify-between">
                        <span>Burn Rate: {item.consumption_rate} {item.supply_unit}/h</span>
                        <span>Urgency Score: {item.urgency_score}</span>
                      </div>
                    </div>

                    {/* Operational Demand Numbers */}
                    <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] font-mono">
                      <div className="bg-slate-950/70 p-2 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">CURRENT DEMAND:</span>
                        <span className="font-bold text-rose-400">
                          {item.current_demand.toLocaleString()} {item.supply_unit}
                        </span>
                      </div>
                      <div className="bg-slate-950/70 p-2 rounded border border-slate-800">
                        <span className="text-[10px] text-slate-500 block">PREDICTED HORIZON:</span>
                        <span className="font-bold text-slate-200">
                          {item.predicted_demand.toLocaleString()} {item.supply_unit}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action CTA */}
                  <div className="mt-4 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-500 text-[10px]">
                      {item.coords.lat.toFixed(3)}°N, {item.coords.lon.toFixed(3)}°E
                    </span>
                    <span className="text-rose-400 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-1 text-[11px]">
                      <span>Dispatch Relief</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-lg mt-4 font-mono">
            <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-200">No Active Critical Shortages</h3>
            <p className="text-xs text-slate-400 mt-1">
              All demand points currently maintain acceptable supply buffers within the 6-hour forecast window.
            </p>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* FILTER BAR & SEARCH                                                 */}
      {/* =================================================================== */}
      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
        {/* Severity Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 text-[11px] uppercase font-bold tracking-wider mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-cyan-400" /> Severity:
          </span>

          <button
            onClick={() => setSeverityFilter('all')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              severityFilter === 'all'
                ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-300 font-bold shadow-glow-cyan'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({consolidatedList.length})
          </button>

          <button
            onClick={() => setSeverityFilter('critical')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              severityFilter === 'critical'
                ? 'bg-rose-950/70 border-rose-500/50 text-rose-300 font-bold shadow-glow-red'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Critical ({totalCritical})
          </button>

          <button
            onClick={() => setSeverityFilter('high')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              severityFilter === 'high'
                ? 'bg-amber-950/70 border-amber-500/50 text-amber-300 font-bold shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            High ({totalHigh})
          </button>

          <button
            onClick={() => setSeverityFilter('medium')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              severityFilter === 'medium'
                ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-300 font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Medium ({totalMedium})
          </button>

          <button
            onClick={() => setSeverityFilter('low')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              severityFilter === 'low'
                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 font-bold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Low ({totalLow})
          </button>
        </div>

        {/* Supply Category Select, Search & View Switcher */}
        <div className="flex items-center gap-3">
          {/* Supply Type Filter Dropdown */}
          <select
            value={supplyFilter}
            onChange={(e) => setSupplyFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700/80 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Supplies</option>
            <option value="medicine">Medical</option>
            <option value="water">Water</option>
            <option value="food">Food</option>
            <option value="fuel">Fuel</option>
            <option value="equipment">Equipment</option>
          </select>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search location or supply..."
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
              title="Cards View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-950/60 border border-rose-500/50 flex items-center justify-between font-mono text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Telemetry Error: {error}</span>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1 rounded bg-rose-900 border border-rose-500/50 text-white font-bold hover:bg-rose-800"
          >
            RETRY
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !consolidatedList.length && (
        <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-lg font-mono">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-200">Evaluating Supply Depletion Curves</h2>
          <p className="text-xs text-slate-500 mt-1">
            Running forecast engine across GET /api/demand-points, /api/predictions & /api/shortages
          </p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !filteredList.length && (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-lg font-mono">
          <Package className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-300">No Shortage Streams Match Filter</h2>
          <p className="text-xs text-slate-500 mt-1">
            No demands found matching severity <span className="text-cyan-400 uppercase">"{severityFilter}"</span>
            {supplyFilter !== 'all' && ` and supply "${supplyFilter}"`}
            {searchQuery && ` with search "${searchQuery}"`}.
          </p>
          <button
            onClick={() => {
              setSeverityFilter('all');
              setSupplyFilter('all');
              setSearchQuery('');
            }}
            className="mt-4 px-3 py-1.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-xs font-bold hover:bg-cyan-900"
          >
            RESET ALL FILTERS
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* 1. TABLE VIEW                                                       */}
      {/* =================================================================== */}
      {!loading && filteredList.length > 0 && viewMode === 'table' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden shadow-sm backdrop-blur">
          <div className="p-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 font-semibold uppercase">
              Showing {filteredList.length} Demand Shortage Streams (Sorted: Critical First)
            </span>
            <span className="text-[11px] text-slate-500">
              Click any stream to open tactical triage drawer
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">DEMAND LOCATION</th>
                  <th className="py-3 px-4">SUPPLY TYPE</th>
                  <th className="py-3 px-4">CURRENT DEMAND</th>
                  <th className="py-3 px-4">PREDICTED DEMAND</th>
                  <th className="py-3 px-4">CONSUMPTION RATE</th>
                  <th className="py-3 px-4">TIME TO SHORTAGE</th>
                  <th className="py-3 px-4">PRIORITY</th>
                  <th className="py-3 px-4">SEVERITY</th>
                  <th className="py-3 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {filteredList.map((item) => {
                  const cfg = SUPPLY_CONFIGS[item.supply_type];
                  const isCritical = item.severity === 'critical';

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedShortageId(item.id)}
                      className={`hover:bg-slate-800/50 transition-colors cursor-pointer ${
                        selectedShortageId === item.id
                          ? 'bg-cyan-950/40 border-l-2 border-l-cyan-400'
                          : isCritical
                          ? 'bg-rose-950/20 hover:bg-rose-950/30'
                          : ''
                      }`}
                    >
                      {/* DEMAND LOCATION */}
                      <td className="py-3.5 px-4 font-bold text-slate-100">
                        <div className="flex items-center gap-2">
                          <MapPin
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isCritical ? 'text-rose-400 animate-pulse' : 'text-slate-400'
                            }`}
                          />
                          <div>
                            <div className="text-cyan-400 flex items-center gap-1.5">
                              <span>{item.demand_callsign}</span>
                              <span className="text-[10px] text-slate-500 font-normal">
                                ({item.demand_point_id})
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-300 font-medium truncate max-w-[170px]">
                              {item.demand_name}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* SUPPLY TYPE */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                          {cfg?.icon || <Package className="w-3.5 h-3.5 text-slate-400" />}
                          <span>{item.supply_label}</span>
                        </div>
                      </td>

                      {/* CURRENT DEMAND */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-bold ${
                            isCritical ? 'text-rose-400' : 'text-slate-200'
                          }`}
                        >
                          {item.current_demand.toLocaleString()} {item.supply_unit}
                        </span>
                      </td>

                      {/* PREDICTED DEMAND */}
                      <td className="py-3.5 px-4 text-slate-300 font-semibold">
                        {item.predicted_demand.toLocaleString()} {item.supply_unit}
                      </td>

                      {/* CONSUMPTION RATE */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-cyan-400" />
                          <span>{item.consumption_rate} {item.supply_unit}/h</span>
                        </div>
                      </td>

                      {/* TIME TO SHORTAGE */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`font-bold flex items-center gap-1 ${
                            isCritical ? 'text-rose-400' : 'text-amber-300'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {item.time_to_shortage_display}
                        </span>
                      </td>

                      {/* PRIORITY */}
                      <td className="py-3.5 px-4">
                        <StatusBadge
                          label={item.priority.toUpperCase()}
                          variant={
                            item.priority === 'critical'
                              ? 'danger'
                              : item.priority === 'high'
                              ? 'warning'
                              : 'info'
                          }
                          size="sm"
                        />
                      </td>

                      {/* SHORTAGE SEVERITY */}
                      <td className="py-3.5 px-4">
                        {renderSeverityBadge(item.severity)}
                      </td>

                      {/* ACTION */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedShortageId(item.id);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-950 hover:text-cyan-300 text-slate-400 text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                        >
                          <span>Triage</span>
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

      {/* =================================================================== */}
      {/* 2. CARDS VIEW                                                       */}
      {/* =================================================================== */}
      {!loading && filteredList.length > 0 && viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredList.map((item) => {
            const cfg = SUPPLY_CONFIGS[item.supply_type];
            const isCritical = item.severity === 'critical';

            return (
              <div
                key={item.id}
                onClick={() => setSelectedShortageId(item.id)}
                className={`bg-slate-900/85 border rounded-lg p-4 transition-all duration-200 cursor-pointer shadow-sm hover:border-cyan-500/60 flex flex-col justify-between relative overflow-hidden group ${
                  selectedShortageId === item.id
                    ? 'border-cyan-500 shadow-glow-cyan bg-slate-900'
                    : isCritical
                    ? 'border-rose-500/50 hover:border-rose-400'
                    : 'border-slate-800'
                }`}
              >
                {/* HUD Corner mark */}
                <div
                  className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 ${
                    isCritical
                      ? 'border-rose-500'
                      : 'border-cyan-500/40 group-hover:border-cyan-400'
                  }`}
                />

                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between pb-2.5 border-b border-slate-800">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-slate-100">
                        {cfg?.icon}
                        <span className="truncate">{item.supply_label}</span>
                      </div>
                      <h4 className="text-xs text-cyan-400 font-mono mt-0.5 truncate">
                        {item.demand_callsign}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-mono truncate">
                        {item.demand_name}
                      </p>
                    </div>

                    <div className="shrink-0">{renderSeverityBadge(item.severity)}</div>
                  </div>

                  {/* Metrics */}
                  <div className="mt-3 space-y-2 font-mono text-xs">
                    {/* Time to shortage callout */}
                    <div className="p-2 rounded bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyan-400" /> Exhaustion:
                      </span>
                      <span
                        className={`font-bold text-[11px] ${
                          isCritical ? 'text-rose-400 font-extrabold' : 'text-amber-300'
                        }`}
                      >
                        {item.time_to_shortage_display}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Current Demand:</span>
                      <span className="text-slate-200 font-bold">
                        {item.current_demand.toLocaleString()} {item.supply_unit}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Predicted Horizon:</span>
                      <span className="text-slate-200 font-bold">
                        {item.predicted_demand.toLocaleString()} {item.supply_unit}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Burn Velocity:</span>
                      <span className="text-cyan-400 font-bold">
                        {item.consumption_rate} {item.supply_unit}/h
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-800">
                      <span className="text-slate-500">Base Priority:</span>
                      <StatusBadge
                        label={item.priority.toUpperCase()}
                        variant={item.priority === 'critical' ? 'danger' : 'info'}
                        size="sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-4 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>{item.demand_point_id}</span>
                  <span className="text-cyan-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
                    Triage →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. DETAILED SHORTAGE & TRIAGE INSPECTION DRAWER                     */}
      {/* =================================================================== */}
      {selectedShortage && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity">
          {/* Backdrop Click */}
          <div className="flex-1" onClick={() => setSelectedShortageId(null)} />

          {/* Drawer Container */}
          <div className="w-full max-w-md bg-slate-950 border-l border-slate-800 h-full overflow-y-auto flex flex-col justify-between shadow-2xl p-6 font-mono relative">
            {/* Top Close Button */}
            <button
              onClick={() => setSelectedShortageId(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
              title="Close Drawer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              {/* Header */}
              <div className="pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  {SUPPLY_CONFIGS[selectedShortage.supply_type]?.icon}
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    {selectedShortage.supply_label} Shortage
                  </h2>
                </div>
                <h3 className="text-sm font-semibold text-cyan-400 mt-1">
                  {selectedShortage.demand_callsign} — {selectedShortage.demand_name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sector: {selectedShortage.sector} ({selectedShortage.demand_point_id})
                </p>
                <div className="flex items-center gap-2 mt-2.5">
                  {renderSeverityBadge(selectedShortage.severity)}
                  <StatusBadge
                    label={`PRIORITY: ${selectedShortage.priority.toUpperCase()}`}
                    variant={selectedShortage.priority === 'critical' ? 'danger' : 'warning'}
                    size="sm"
                  />
                </div>
              </div>

              {/* Telemetry Details */}
              <div className="mt-5 space-y-4 text-xs">
                <h3 className="text-slate-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Depletion & Consumption Telemetry</span>
                </h3>

                <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Time to Exhaustion:</span>
                    <span className="font-bold text-rose-400 text-sm">
                      {selectedShortage.time_to_shortage_display}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Current Required Demand:</span>
                    <span className="font-bold text-slate-100">
                      {selectedShortage.current_demand.toLocaleString()} {selectedShortage.supply_unit}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Forecasted Horizon Demand:</span>
                    <span className="font-bold text-slate-100">
                      {selectedShortage.predicted_demand.toLocaleString()} {selectedShortage.supply_unit}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Hourly Burn Rate:</span>
                    <span className="font-bold text-cyan-400">
                      {selectedShortage.consumption_rate} {selectedShortage.supply_unit}/h
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Urgency Priority Score:</span>
                    <span className="font-bold text-amber-300">
                      {selectedShortage.urgency_score}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">GPS Coordinates:</span>
                    <span className="font-bold text-slate-300">
                      {selectedShortage.coords.lat.toFixed(4)}°N, {selectedShortage.coords.lon.toFixed(4)}°E
                    </span>
                  </div>
                </div>

                {/* Recommended Resupply Package */}
                <div className="bg-slate-900/80 border border-cyan-500/40 rounded-lg p-3.5 space-y-2 font-mono">
                  <span className="text-[10px] text-cyan-400 uppercase font-bold tracking-wider block">
                    RECOMMENDED RESUPPLY PACKAGE:
                  </span>
                  <div className="flex justify-between items-baseline">
                    <span className="text-slate-300 text-xs">Airlift / Convoy Volume:</span>
                    <span className="text-lg font-bold text-cyan-400">
                      {selectedShortage.recommended_resupply.toLocaleString()} {selectedShortage.supply_unit}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Volume calculated to cover current deficit plus lookahead consumption buffer.
                  </p>
                </div>
              </div>
            </div>

            {/* Tactical Actions */}
            <div className="pt-6 border-t border-slate-800 space-y-2 mt-6">
              <button
                onClick={() => {
                  alert(
                    `Emergency dispatch scheduled for ${selectedShortage.demand_callsign} (${selectedShortage.supply_label}: ${selectedShortage.recommended_resupply} ${selectedShortage.supply_unit})`
                  );
                }}
                className="w-full py-2.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-glow-red"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>ALLOCATE EMERGENCY CONVOY</span>
              </button>
              <button
                onClick={() => setSelectedShortageId(null)}
                className="w-full py-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                CLOSE TRIAGE PANEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

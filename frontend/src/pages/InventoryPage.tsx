import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package,
  Droplets,
  HeartPulse,
  Fuel,
  Wrench,
  Building2,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  LayoutGrid,
  List,
  X,
  ChevronRight,
  MapPin,
  TrendingUp,
  AlertCircle,
  Truck,
  Send,
  Boxes,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { KPICard } from '../components/KPICard';
import { StatusBadge, StatusVariant } from '../components/StatusBadge';
import { Depot, LogisticsState, Delivery, Vehicle } from '../types';
import { apiService } from '../services/api';

// Supported 5 core supply categories required by MissionPath
export type SupplyCategoryKey = 'medicine' | 'water' | 'food' | 'fuel' | 'equipment';

interface CategoryConfig {
  key: SupplyCategoryKey;
  label: string;
  unit: string;
  maxPerDepot: number;
  icon: React.ReactNode;
  accentColor: string;
  bgBadge: string;
}

const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    key: 'medicine',
    label: 'Medical',
    unit: 'Units',
    maxPerDepot: 10000,
    icon: <HeartPulse className="w-4 h-4 text-emerald-400" />,
    accentColor: 'text-emerald-400',
    bgBadge: 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300',
  },
  {
    key: 'water',
    label: 'Water',
    unit: 'L',
    maxPerDepot: 35000,
    icon: <Droplets className="w-4 h-4 text-cyan-400" />,
    accentColor: 'text-cyan-400',
    bgBadge: 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300',
  },
  {
    key: 'food',
    label: 'Food',
    unit: 'kg',
    maxPerDepot: 25000,
    icon: <Package className="w-4 h-4 text-amber-400" />,
    accentColor: 'text-amber-400',
    bgBadge: 'bg-amber-950/70 border-amber-500/40 text-amber-300',
  },
  {
    key: 'fuel',
    label: 'Fuel',
    unit: 'L',
    maxPerDepot: 40000,
    icon: <Fuel className="w-4 h-4 text-rose-400" />,
    accentColor: 'text-rose-400',
    bgBadge: 'bg-rose-950/70 border-rose-500/40 text-rose-300',
  },
  {
    key: 'equipment',
    label: 'Equipment',
    unit: 'Kits',
    maxPerDepot: 10000,
    icon: <Wrench className="w-4 h-4 text-indigo-400" />,
    accentColor: 'text-indigo-400',
    bgBadge: 'bg-indigo-950/70 border-indigo-500/40 text-indigo-300',
  },
];

// Human-friendly tactical depot metadata
const DEPOT_METADATA: Record<string, { name: string; sector: string }> = {
  'DEPOT-ALPHA': {
    name: 'Forward Staging Base Alpha',
    sector: 'Dehradun Northern Corridor',
  },
  'DEPOT-BRAVO': {
    name: 'Central Logistics Hub Bravo',
    sector: 'Rishikesh Valley Command',
  },
  'DEPOT-CHARLIE': {
    name: 'Airfield Support Depot Charlie',
    sector: 'Jolly Grant Strategic Aerodrome',
  },
};

type DepotFilter = 'all' | 'healthy' | 'low' | 'critical';

export const InventoryPage: React.FC = () => {
  const [depots, setDepots] = useState<Depot[]>([]);
  const [logisticsState, setLogisticsState] = useState<LogisticsState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState<DepotFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedDepotId, setSelectedDepotId] = useState<string | null>(null);

  // Fetch depot stockpiles and live logistics state concurrently
  const loadInventoryData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [depotsData, stateData] = await Promise.all([
        apiService.getDepots(),
        apiService.getLogisticsState().catch(() => null),
      ]);

      setDepots(depotsData || []);
      setLogisticsState(stateData);
    } catch (err: any) {
      console.error('Failed to load inventory data:', err);
      setError(err?.message || 'Unable to connect to inventory backend service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventoryData();
  }, [loadInventoryData]);

  // Extract category stock helper
  const getCategoryStock = (depot: Depot, key: SupplyCategoryKey): number => {
    if (!depot.inventory) return 0;
    if (key === 'medicine') {
      return depot.inventory.medicine ?? depot.inventory.medical ?? 0;
    }
    return depot.inventory[key] ?? 0;
  };

  // Evaluation of stock level: Critical (< 25%), Low (25% - 49%), Healthy (>= 50%)
  const evaluateStock = (value: number, maxCapacity: number) => {
    const pct = Math.min(100, Math.max(0, (value / (maxCapacity || 1)) * 100));
    if (pct < 25) {
      return {
        level: 'critical' as const,
        label: 'CRITICAL',
        pct,
        variant: 'danger' as StatusVariant,
        colorClass: 'text-rose-400',
        bgPill: 'bg-rose-950/80 border-rose-500/50 text-rose-300',
        progressBar: 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.7)]',
      };
    }
    if (pct < 50) {
      return {
        level: 'low' as const,
        label: 'LOW STOCK',
        pct,
        variant: 'warning' as StatusVariant,
        colorClass: 'text-amber-400',
        bgPill: 'bg-amber-950/80 border-amber-500/50 text-amber-300',
        progressBar: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
      };
    }
    return {
      level: 'healthy' as const,
      label: 'HEALTHY',
      pct,
      variant: 'success' as StatusVariant,
      colorClass: 'text-emerald-400',
      bgPill: 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300',
      progressBar: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]',
    };
  };

  // Evaluate overall depot status
  const evaluateDepotOverall = (depot: Depot) => {
    let hasCritical = false;
    let hasLow = false;

    CATEGORY_CONFIGS.forEach((cfg) => {
      const stock = getCategoryStock(depot, cfg.key);
      const evaluation = evaluateStock(stock, cfg.maxPerDepot);
      if (evaluation.level === 'critical') hasCritical = true;
      if (evaluation.level === 'low') hasLow = true;
    });

    if (hasCritical) {
      return {
        status: 'critical' as const,
        label: 'CRITICAL SHORTAGE',
        variant: 'danger' as StatusVariant,
      };
    }
    if (hasLow) {
      return {
        status: 'low' as const,
        label: 'LOW STOCK / MONITOR',
        variant: 'warning' as StatusVariant,
      };
    }
    return {
      status: 'healthy' as const,
      label: 'OPTIMAL / HEALTHY',
      variant: 'success' as StatusVariant,
    };
  };

  // -------------------------------------------------------------------------
  // Total Inventory Calculations Across Entire Network
  // -------------------------------------------------------------------------
  const networkTotals = useMemo(() => {
    const totals: Record<SupplyCategoryKey, number> = {
      medicine: 0,
      water: 0,
      food: 0,
      fuel: 0,
      equipment: 0,
    };

    let totalNetworkUnits = 0;
    let totalNetworkMax = 0;

    depots.forEach((depot) => {
      CATEGORY_CONFIGS.forEach((cfg) => {
        const val = getCategoryStock(depot, cfg.key);
        totals[cfg.key] += val;
        totalNetworkUnits += val;
        totalNetworkMax += cfg.maxPerDepot;
      });
    });

    return {
      totals,
      totalNetworkUnits,
      totalNetworkMax,
      networkHealthPct: totalNetworkMax > 0 ? (totalNetworkUnits / totalNetworkMax) * 100 : 0,
    };
  }, [depots]);

  // Filtered Depots
  const filteredDepots = useMemo(() => {
    return depots.filter((depot) => {
      const overall = evaluateDepotOverall(depot);

      // Filter by level
      if (activeFilter === 'healthy' && overall.status !== 'healthy') return false;
      if (activeFilter === 'low' && overall.status !== 'low') return false;
      if (activeFilter === 'critical' && overall.status !== 'critical') return false;

      // Filter by search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const meta = DEPOT_METADATA[depot.id];
        const matchId = depot.id.toLowerCase().includes(q);
        const matchName = meta?.name.toLowerCase().includes(q);
        const matchSector = meta?.sector.toLowerCase().includes(q);
        const matchCoords = `${depot.location.lat},${depot.location.lon}`.includes(q);

        if (!matchId && !matchName && !matchSector && !matchCoords) return false;
      }

      return true;
    });
  }, [depots, activeFilter, searchQuery]);

  // Counts for filter pills
  const counts = useMemo(() => {
    let healthyCount = 0;
    let lowCount = 0;
    let criticalCount = 0;

    depots.forEach((d) => {
      const overall = evaluateDepotOverall(d);
      if (overall.status === 'healthy') healthyCount++;
      else if (overall.status === 'low') lowCount++;
      else if (overall.status === 'critical') criticalCount++;
    });

    return {
      total: depots.length,
      healthy: healthyCount,
      low: lowCount,
      critical: criticalCount,
    };
  }, [depots]);

  // Selected Depot Details
  const selectedDepot = useMemo(() => {
    if (!selectedDepotId) return null;
    return depots.find((d) => d.id === selectedDepotId) || null;
  }, [depots, selectedDepotId]);

  // Deliveries originating from selected depot
  const activeDeliveriesFromDepot = useMemo(() => {
    if (!selectedDepotId || !logisticsState?.deliveries) return [];
    return logisticsState.deliveries.filter((del: Delivery) => del.source_id === selectedDepotId);
  }, [logisticsState, selectedDepotId]);

  // Vehicles stationed near or at selected depot
  const vehiclesAtDepot = useMemo(() => {
    if (!selectedDepot || !logisticsState?.vehicles) return [];
    return Object.values(logisticsState.vehicles).filter((v: Vehicle) => {
      const dLat = Math.abs(v.current_location.lat - selectedDepot.location.lat);
      const dLon = Math.abs(v.current_location.lon - selectedDepot.location.lon);
      return dLat < 0.05 && dLon < 0.05;
    });
  }, [logisticsState, selectedDepot]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-[10px] font-mono font-semibold text-cyan-400">
              SUPPLY-04 // STOCKPILES & DEPOTS
            </span>
            <span className="text-xs font-mono text-slate-500">
              ENDPOINTS: GET /api/depots & GET /api/state
            </span>
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-tight text-white mt-1">
            Depot Stockpiles & Network Inventory
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time multi-depot monitoring of medical provisions, potable water, rations, fuel, and rescue equipment.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadInventoryData}
            disabled={loading}
            className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 hover:border-cyan-500/40 text-xs font-mono text-slate-300 hover:text-cyan-400 flex items-center gap-2 transition-colors"
            title="Refresh Inventory Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>SYNC STOCKPILES</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* SECTION 1: TOTAL INVENTORY ACROSS ENTIRE NETWORK                    */}
      {/* =================================================================== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-mono text-xs text-slate-300 font-bold uppercase tracking-wider">
            <Boxes className="w-4 h-4 text-cyan-400" />
            <span>Total Network Inventory (Aggregate across {depots.length} Depots)</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            NETWORK SATURATION: {networkTotals.networkHealthPct.toFixed(1)}%
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
          {/* Total Network Units */}
          <KPICard
            title="Total Network Stock"
            value={networkTotals.totalNetworkUnits.toLocaleString()}
            unit="Combined Units"
            statusText="STRATEGIC POOL"
            statusVariant="info"
            icon={<Building2 className="w-4 h-4 text-cyan-400" />}
            subtext={`${depots.length} Active Storage Bases`}
            progress={networkTotals.networkHealthPct}
          />

          {/* 1. Medical Total */}
          {(() => {
            const val = networkTotals.totals.medicine;
            const max = CATEGORY_CONFIGS[0].maxPerDepot * (depots.length || 1);
            const evalResult = evaluateStock(val, max);
            return (
              <KPICard
                title="Medical Aid"
                value={val.toLocaleString()}
                unit="Units"
                statusText={evalResult.label}
                statusVariant={evalResult.variant}
                icon={<HeartPulse className="w-4 h-4 text-emerald-400" />}
                subtext={`Target: ${max.toLocaleString()} Units`}
                progress={evalResult.pct}
                alert={evalResult.level === 'critical'}
              />
            );
          })()}

          {/* 2. Water Total */}
          {(() => {
            const val = networkTotals.totals.water;
            const max = CATEGORY_CONFIGS[1].maxPerDepot * (depots.length || 1);
            const evalResult = evaluateStock(val, max);
            return (
              <KPICard
                title="Potable Water"
                value={val.toLocaleString()}
                unit="Litres"
                statusText={evalResult.label}
                statusVariant={evalResult.variant}
                icon={<Droplets className="w-4 h-4 text-cyan-400" />}
                subtext={`Target: ${max.toLocaleString()} L`}
                progress={evalResult.pct}
                alert={evalResult.level === 'critical'}
              />
            );
          })()}

          {/* 3. Food Total */}
          {(() => {
            const val = networkTotals.totals.food;
            const max = CATEGORY_CONFIGS[2].maxPerDepot * (depots.length || 1);
            const evalResult = evaluateStock(val, max);
            return (
              <KPICard
                title="Food Rations"
                value={val.toLocaleString()}
                unit="Kg"
                statusText={evalResult.label}
                statusVariant={evalResult.variant}
                icon={<Package className="w-4 h-4 text-amber-400" />}
                subtext={`Target: ${max.toLocaleString()} Kg`}
                progress={evalResult.pct}
                alert={evalResult.level === 'critical'}
              />
            );
          })()}

          {/* 4. Fuel Total */}
          {(() => {
            const val = networkTotals.totals.fuel;
            const max = CATEGORY_CONFIGS[3].maxPerDepot * (depots.length || 1);
            const evalResult = evaluateStock(val, max);
            return (
              <KPICard
                title="Vehicle Fuel"
                value={val.toLocaleString()}
                unit="Litres"
                statusText={evalResult.label}
                statusVariant={evalResult.variant}
                icon={<Fuel className="w-4 h-4 text-rose-400" />}
                subtext={`Target: ${max.toLocaleString()} L`}
                progress={evalResult.pct}
                alert={evalResult.level === 'critical'}
              />
            );
          })()}

          {/* 5. Equipment Total */}
          {(() => {
            const val = networkTotals.totals.equipment;
            const max = CATEGORY_CONFIGS[4].maxPerDepot * (depots.length || 1);
            const evalResult = evaluateStock(val, max);
            return (
              <KPICard
                title="Equipment & Gear"
                value={val.toLocaleString()}
                unit="Kits"
                statusText={evalResult.label}
                statusVariant={evalResult.variant}
                icon={<Wrench className="w-4 h-4 text-indigo-400" />}
                subtext={`Target: ${max.toLocaleString()} Kits`}
                progress={evalResult.pct}
                alert={evalResult.level === 'critical'}
              />
            );
          })()}
        </div>
      </div>

      {/* =================================================================== */}
      {/* SECTION 2: FILTERS, SEARCH & VIEW SWITCHER                          */}
      {/* =================================================================== */}
      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
        {/* Category / Stock Level Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 text-[11px] uppercase font-bold tracking-wider mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-cyan-400" /> Filter Depots:
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
            All Depots ({counts.total})
          </button>

          {/* Healthy */}
          <button
            onClick={() => setActiveFilter('healthy')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              activeFilter === 'healthy'
                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 font-bold shadow-glow-green'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Healthy ({counts.healthy})
          </button>

          {/* Low Stock */}
          <button
            onClick={() => setActiveFilter('low')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              activeFilter === 'low'
                ? 'bg-amber-950/70 border-amber-500/50 text-amber-300 font-bold shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Low Stock ({counts.low})
          </button>

          {/* Critical */}
          <button
            onClick={() => setActiveFilter('critical')}
            className={`px-2.5 py-1 rounded border transition-colors ${
              activeFilter === 'critical'
                ? 'bg-rose-950/70 border-rose-500/50 text-rose-300 font-bold shadow-glow-red'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Critical Shortage ({counts.critical})
          </button>
        </div>

        {/* Search & View Mode Switcher */}
        <div className="flex items-center gap-3">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Depot or Sector..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-700/80 rounded pl-8 pr-3 py-1 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors w-40 sm:w-56"
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
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'cards' ? 'bg-cyan-950 text-cyan-300' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Cards View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'table' ? 'bg-cyan-950 text-cyan-300' : 'text-slate-500 hover:text-slate-300'
              }`}
              title="Matrix Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error State Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-950/60 border border-rose-500/50 flex items-center justify-between font-mono text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Error connecting to /api/depots: {error}</span>
          </div>
          <button
            onClick={loadInventoryData}
            className="px-3 py-1 rounded bg-rose-900 border border-rose-500/50 text-white font-bold hover:bg-rose-800"
          >
            RETRY
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !depots.length && (
        <div className="p-12 text-center bg-slate-900/50 border border-slate-800 rounded-lg font-mono">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-200">Synchronizing Depot Stockpiles</h2>
          <p className="text-xs text-slate-500 mt-1">
            Querying FastAPI endpoints: GET /api/depots & GET /api/state
          </p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !filteredDepots.length && (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-lg font-mono">
          <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-300">No Depots Match Filter Criteria</h2>
          <p className="text-xs text-slate-500 mt-1">
            No active depots found for status <span className="text-cyan-400 uppercase">"{activeFilter}"</span>
            {searchQuery && ` matching "${searchQuery}"`}.
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

      {/* =================================================================== */}
      {/* SECTION 3: DEPOT CARDS VIEW                                         */}
      {/* =================================================================== */}
      {!loading && filteredDepots.length > 0 && viewMode === 'cards' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {filteredDepots.map((depot) => {
            const meta = DEPOT_METADATA[depot.id] || {
              name: `Logistics Base ${depot.id}`,
              sector: 'Regional Disaster Zone',
            };
            const overall = evaluateDepotOverall(depot);

            // Compute total stock units stored in this depot
            let depotTotalUnits = 0;
            let depotMaxUnits = 0;
            CATEGORY_CONFIGS.forEach((cfg) => {
              depotTotalUnits += getCategoryStock(depot, cfg.key);
              depotMaxUnits += cfg.maxPerDepot;
            });
            const depotCapacityPct = Math.round((depotTotalUnits / depotMaxUnits) * 100);

            return (
              <div
                key={depot.id}
                onClick={() => setSelectedDepotId(depot.id)}
                className={`group bg-slate-900/85 border rounded-lg p-5 flex flex-col justify-between relative overflow-hidden transition-all duration-200 cursor-pointer shadow-sm hover:border-cyan-500/60 ${
                  selectedDepotId === depot.id
                    ? 'border-cyan-500 shadow-glow-cyan bg-slate-900'
                    : overall.status === 'critical'
                    ? 'border-rose-500/50 hover:border-rose-400'
                    : overall.status === 'low'
                    ? 'border-amber-500/40 hover:border-amber-400'
                    : 'border-slate-800'
                }`}
              >
                {/* HUD Corner Marker */}
                <div
                  className={`absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 transition-colors ${
                    overall.status === 'critical'
                      ? 'border-rose-500'
                      : overall.status === 'low'
                      ? 'border-amber-500'
                      : 'border-cyan-500/40 group-hover:border-cyan-400'
                  }`}
                />

                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-cyan-400" />
                        <span className="font-mono text-sm font-bold text-slate-100">{depot.id}</span>
                      </div>
                      <h3 className="font-mono text-xs font-semibold text-slate-300 mt-1">
                        {meta.name}
                      </h3>
                      <p className="text-[10px] font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>
                          {depot.location.lat.toFixed(4)}°N, {depot.location.lon.toFixed(4)}°E // {meta.sector}
                        </span>
                      </p>
                    </div>

                    <StatusBadge
                      label={overall.label}
                      variant={overall.variant}
                      size="sm"
                      pulse={overall.status === 'critical'}
                    />
                  </div>

                  {/* Depot Capacity Utilization Gauge */}
                  <div className="mt-4 p-2.5 rounded bg-slate-950/70 border border-slate-800/80 font-mono">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="text-slate-400 text-[11px]">Aggregate Storage Saturation:</span>
                      <span className="text-slate-200 font-bold">
                        {depotTotalUnits.toLocaleString()} / {depotMaxUnits.toLocaleString()} ({depotCapacityPct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full ${
                          depotCapacityPct > 80
                            ? 'bg-amber-500'
                            : depotCapacityPct > 40
                            ? 'bg-cyan-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${depotCapacityPct}%` }}
                      />
                    </div>
                  </div>

                  {/* --------------------------------------------------------- */}
                  {/* 5 Supply Category Breakdown with Progress & Status        */}
                  {/* --------------------------------------------------------- */}
                  <div className="mt-4 space-y-3 font-mono">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider pb-1 border-b border-slate-800/60">
                      <span>SUPPLY CATEGORY</span>
                      <span>STOCK / TARGET</span>
                      <span>STATUS</span>
                    </div>

                    {CATEGORY_CONFIGS.map((cfg) => {
                      const stockVal = getCategoryStock(depot, cfg.key);
                      const evalResult = evaluateStock(stockVal, cfg.maxPerDepot);

                      return (
                        <div key={cfg.key} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            {/* Category Icon & Name */}
                            <div className="flex items-center gap-1.5 w-28 shrink-0">
                              {cfg.icon}
                              <span className="font-semibold text-slate-200 text-[11px]">{cfg.label}</span>
                            </div>

                            {/* Value / Target */}
                            <div className="text-center font-mono text-[11px]">
                              <span className="font-bold text-slate-100">{stockVal.toLocaleString()}</span>
                              <span className="text-slate-500 text-[10px]">
                                {' '}/ {cfg.maxPerDepot.toLocaleString()} {cfg.unit}
                              </span>
                            </div>

                            {/* Status Indicator Tag */}
                            <div className="w-24 text-right">
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold tracking-tight uppercase border ${
                                  evalResult.level === 'critical'
                                    ? 'bg-rose-950/80 text-rose-300 border-rose-500/50 animate-pulse'
                                    : evalResult.level === 'low'
                                    ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                                }`}
                              >
                                {evalResult.label}
                              </span>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${evalResult.progressBar}`}
                              style={{ width: `${evalResult.pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between font-mono text-[11px] text-slate-500">
                  <span>DISPATCH STAGE: READY</span>
                  <span className="text-cyan-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
                    Inspect Stockpile →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 4: DEPOT MATRIX TABLE VIEW                                  */}
      {/* =================================================================== */}
      {!loading && filteredDepots.length > 0 && viewMode === 'table' && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-lg overflow-hidden shadow-sm backdrop-blur">
          <div className="p-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 font-semibold uppercase">
              Showing {filteredDepots.length} of {depots.length} Supply Hubs
            </span>
            <span className="text-[11px] text-slate-500">
              Click any depot row to inspect operational allocations
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">DEPOT</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4">TOTAL UTILIZATION</th>
                  <th className="py-3 px-4">MEDICAL</th>
                  <th className="py-3 px-4">WATER</th>
                  <th className="py-3 px-4">FOOD</th>
                  <th className="py-3 px-4">FUEL</th>
                  <th className="py-3 px-4">EQUIPMENT</th>
                  <th className="py-3 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {filteredDepots.map((depot) => {
                  const meta = DEPOT_METADATA[depot.id] || {
                    name: depot.id,
                    sector: 'Sector Alpha',
                  };
                  const overall = evaluateDepotOverall(depot);

                  let depotTotalUnits = 0;
                  let depotMaxUnits = 0;
                  CATEGORY_CONFIGS.forEach((cfg) => {
                    depotTotalUnits += getCategoryStock(depot, cfg.key);
                    depotMaxUnits += cfg.maxPerDepot;
                  });
                  const depotCapacityPct = Math.round((depotTotalUnits / depotMaxUnits) * 100);

                  return (
                    <tr
                      key={depot.id}
                      onClick={() => setSelectedDepotId(depot.id)}
                      className={`hover:bg-slate-800/50 transition-colors cursor-pointer ${
                        selectedDepotId === depot.id ? 'bg-cyan-950/40 border-l-2 border-l-cyan-400' : ''
                      }`}
                    >
                      {/* DEPOT NAME & COORDS */}
                      <td className="py-3.5 px-4 font-bold text-slate-100">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <div>
                            <div className="text-cyan-400">{depot.id}</div>
                            <div className="text-[10px] text-slate-500 font-normal truncate max-w-[140px]">
                              {meta.name}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* OVERALL STATUS */}
                      <td className="py-3.5 px-4">
                        <StatusBadge
                          label={overall.label}
                          variant={overall.variant}
                          size="sm"
                          pulse={overall.status === 'critical'}
                        />
                      </td>

                      {/* TOTAL UTILIZATION */}
                      <td className="py-3.5 px-4">
                        <div>
                          <div className="text-slate-200 font-bold">
                            {depotCapacityPct}% ({depotTotalUnits.toLocaleString()} units)
                          </div>
                          <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden mt-1">
                            <div
                              className="h-full bg-cyan-500"
                              style={{ width: `${depotCapacityPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* MEDICAL */}
                      <td className="py-3.5 px-4">
                        {(() => {
                          const stock = getCategoryStock(depot, 'medicine');
                          const evaluation = evaluateStock(stock, CATEGORY_CONFIGS[0].maxPerDepot);
                          return (
                            <div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className={`font-bold ${evaluation.colorClass}`}>{stock.toLocaleString()}</span>
                                <span className="text-[9px] text-slate-500">{evaluation.pct.toFixed(0)}%</span>
                              </div>
                              <div className="w-20 h-1 rounded-full bg-slate-800 overflow-hidden mt-1">
                                <div
                                  className={`h-full ${evaluation.progressBar}`}
                                  style={{ width: `${evaluation.pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* WATER */}
                      <td className="py-3.5 px-4">
                        {(() => {
                          const stock = getCategoryStock(depot, 'water');
                          const evaluation = evaluateStock(stock, CATEGORY_CONFIGS[1].maxPerDepot);
                          return (
                            <div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className={`font-bold ${evaluation.colorClass}`}>{stock.toLocaleString()} L</span>
                                <span className="text-[9px] text-slate-500">{evaluation.pct.toFixed(0)}%</span>
                              </div>
                              <div className="w-20 h-1 rounded-full bg-slate-800 overflow-hidden mt-1">
                                <div
                                  className={`h-full ${evaluation.progressBar}`}
                                  style={{ width: `${evaluation.pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* FOOD */}
                      <td className="py-3.5 px-4">
                        {(() => {
                          const stock = getCategoryStock(depot, 'food');
                          const evaluation = evaluateStock(stock, CATEGORY_CONFIGS[2].maxPerDepot);
                          return (
                            <div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className={`font-bold ${evaluation.colorClass}`}>{stock.toLocaleString()} kg</span>
                                <span className="text-[9px] text-slate-500">{evaluation.pct.toFixed(0)}%</span>
                              </div>
                              <div className="w-20 h-1 rounded-full bg-slate-800 overflow-hidden mt-1">
                                <div
                                  className={`h-full ${evaluation.progressBar}`}
                                  style={{ width: `${evaluation.pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* FUEL */}
                      <td className="py-3.5 px-4">
                        {(() => {
                          const stock = getCategoryStock(depot, 'fuel');
                          const evaluation = evaluateStock(stock, CATEGORY_CONFIGS[3].maxPerDepot);
                          return (
                            <div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className={`font-bold ${evaluation.colorClass}`}>{stock.toLocaleString()} L</span>
                                <span className="text-[9px] text-slate-500">{evaluation.pct.toFixed(0)}%</span>
                              </div>
                              <div className="w-20 h-1 rounded-full bg-slate-800 overflow-hidden mt-1">
                                <div
                                  className={`h-full ${evaluation.progressBar}`}
                                  style={{ width: `${evaluation.pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* EQUIPMENT */}
                      <td className="py-3.5 px-4">
                        {(() => {
                          const stock = getCategoryStock(depot, 'equipment');
                          const evaluation = evaluateStock(stock, CATEGORY_CONFIGS[4].maxPerDepot);
                          return (
                            <div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className={`font-bold ${evaluation.colorClass}`}>{stock.toLocaleString()}</span>
                                <span className="text-[9px] text-slate-500">{evaluation.pct.toFixed(0)}%</span>
                              </div>
                              <div className="w-20 h-1 rounded-full bg-slate-800 overflow-hidden mt-1">
                                <div
                                  className={`h-full ${evaluation.progressBar}`}
                                  style={{ width: `${evaluation.pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* ACTION */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDepotId(depot.id);
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

      {/* =================================================================== */}
      {/* SECTION 5: DETAILED DEPOT INSPECTION DRAWER (Slide-Over Panel)      */}
      {/* =================================================================== */}
      {selectedDepot && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity">
          {/* Backdrop Click */}
          <div className="flex-1" onClick={() => setSelectedDepotId(null)} />

          {/* Drawer Container */}
          <div className="w-full max-w-lg bg-slate-950 border-l border-slate-800 h-full overflow-y-auto flex flex-col justify-between shadow-2xl p-6 font-mono relative">
            {/* Top Close Button */}
            <button
              onClick={() => setSelectedDepotId(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
              title="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              {/* Header */}
              <div className="pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    {selectedDepot.id}
                  </h2>
                </div>
                <p className="text-xs text-slate-300 font-semibold mt-1">
                  {DEPOT_METADATA[selectedDepot.id]?.name || 'Regional Strategic Depot'}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge
                    label={evaluateDepotOverall(selectedDepot).label}
                    variant={evaluateDepotOverall(selectedDepot).variant}
                    size="md"
                    pulse={evaluateDepotOverall(selectedDepot).status === 'critical'}
                  />
                  <span className="text-[11px] text-slate-500">
                    {selectedDepot.location.lat.toFixed(4)}°N, {selectedDepot.location.lon.toFixed(4)}°E
                  </span>
                </div>
              </div>

              {/* Detailed Breakdown for All 5 Categories */}
              <div className="mt-5 space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-slate-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-cyan-400" /> Granular Stockpile Metrics
                  </h3>
                  <span className="text-[10px] text-slate-500">
                    CRITICAL &lt; 25% | LOW &lt; 50%
                  </span>
                </div>

                <div className="space-y-3">
                  {CATEGORY_CONFIGS.map((cfg) => {
                    const currentStock = getCategoryStock(selectedDepot, cfg.key);
                    const evaluation = evaluateStock(currentStock, cfg.maxPerDepot);
                    const networkShare =
                      networkTotals.totals[cfg.key] > 0
                        ? ((currentStock / networkTotals.totals[cfg.key]) * 100).toFixed(1)
                        : '0';

                    return (
                      <div
                        key={cfg.key}
                        className={`p-3 rounded-lg border bg-slate-900/80 transition-colors ${
                          evaluation.level === 'critical'
                            ? 'border-rose-500/50'
                            : evaluation.level === 'low'
                            ? 'border-amber-500/40'
                            : 'border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                          <div className="flex items-center gap-2">
                            {cfg.icon}
                            <span className="font-bold text-slate-200">{cfg.label}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${evaluation.bgPill}`}
                          >
                            {evaluation.label}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-2.5 text-[11px]">
                          <div>
                            <span className="text-slate-500 block text-[10px]">CURRENT STOCK:</span>
                            <span className={`font-bold ${evaluation.colorClass}`}>
                              {currentStock.toLocaleString()} {cfg.unit}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">STORAGE CAP:</span>
                            <span className="font-bold text-slate-300">
                              {cfg.maxPerDepot.toLocaleString()} {cfg.unit}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">NETWORK SHARE:</span>
                            <span className="font-bold text-cyan-400">{networkShare}%</span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-3">
                          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                            <span>Capacity Saturation: {evaluation.pct.toFixed(1)}%</span>
                            <span>
                              {evaluation.level === 'critical'
                                ? 'DEFICIT ALERT'
                                : evaluation.level === 'low'
                                ? 'REPLENISH SUGGESTED'
                                : 'OPTIMAL'}
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${evaluation.progressBar}`}
                              style={{ width: `${evaluation.pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Co-located Vehicles at Depot */}
                <div className="mt-5 pt-3 border-t border-slate-800">
                  <h3 className="text-slate-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5 mb-2">
                    <Truck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Stationed Transport Units ({vehiclesAtDepot.length})</span>
                  </h3>
                  {vehiclesAtDepot.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {vehiclesAtDepot.map((veh) => (
                        <div
                          key={veh.id}
                          className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]"
                        >
                          <span className="font-bold text-cyan-400">{veh.id}</span>
                          <span className="text-slate-400">
                            {veh.available ? 'AVAILABLE' : 'BUSY'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">
                      No vehicles currently staged in proximity of this hub.
                    </p>
                  )}
                </div>

                {/* Active Dispatches from this Depot */}
                <div className="mt-4 pt-3 border-t border-slate-800">
                  <h3 className="text-slate-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5 mb-2">
                    <Send className="w-3.5 h-3.5 text-amber-400" />
                    <span>Active Dispatches from Hub ({activeDeliveriesFromDepot.length})</span>
                  </h3>
                  {activeDeliveriesFromDepot.length > 0 ? (
                    <div className="space-y-1.5">
                      {activeDeliveriesFromDepot.map((del) => (
                        <div
                          key={del.id}
                          className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px]"
                        >
                          <div>
                            <span className="text-slate-200 font-bold">{del.id}</span>
                            <span className="text-slate-500 text-[10px] ml-2">
                              → {del.destination_id}
                            </span>
                          </div>
                          <StatusBadge
                            label={del.status.toUpperCase()}
                            variant={del.status === 'in_transit' ? 'info' : 'neutral'}
                            size="sm"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic">
                      No outbound relief runs actively in-transit from this depot.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Tactical Actions */}
            <div className="pt-6 border-t border-slate-800 space-y-2 mt-6">
              <button
                onClick={() => {
                  alert(
                    `Emergency replenishment protocol activated for ${selectedDepot.id}. Requesting redistribution from surplus depots.`
                  );
                }}
                className="w-full py-2.5 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-glow-cyan"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>REQUEST STRATEGIC RE-SUPPLY</span>
              </button>
              <button
                onClick={() => setSelectedDepotId(null)}
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

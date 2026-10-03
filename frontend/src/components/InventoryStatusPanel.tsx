import React, { useState } from 'react';
import { Boxes, Droplets, HeartPulse, Package, Fuel, Wrench, AlertCircle, RefreshCw } from 'lucide-react';
import { Panel } from './Panel';
import { StatusBadge } from './StatusBadge';
import { Depot } from '../types';

export interface DepotStockItem {
  id: string;
  name: string;
  utilization: number;
  supplies: {
    medicine: { qty: string; pct: number };
    water: { qty: string; pct: number };
    food: { qty: string; pct: number };
    fuel: { qty: string; pct: number };
    equipment: { qty: string; pct: number };
  };
}

interface InventoryStatusPanelProps {
  depots?: Depot[];
  loading?: boolean;
}

export const InventoryStatusPanel: React.FC<InventoryStatusPanelProps> = ({ depots, loading = false }) => {
  const [selectedDepotIndex, setSelectedDepotIndex] = useState(0);

  // Convert real depots from backend API
  const displayDepots: DepotStockItem[] = (depots || []).map((d) => {
    const total = Object.values(d.inventory || {}).reduce((a, b) => a + b, 0);
    return {
      id: d.id,
      name: `${d.id.replace('DEPOT-', '')} Logistics Base`,
      utilization: Math.min(100, Math.round((total / 85000) * 100)),
      supplies: {
        medicine: {
          qty: `${(d.inventory['medicine'] || 0).toLocaleString()} kg`,
          pct: Math.min(100, Math.round(((d.inventory['medicine'] || 0) / 10000) * 100)),
        },
        water: {
          qty: `${(d.inventory['water'] || 0).toLocaleString()} L`,
          pct: Math.min(100, Math.round(((d.inventory['water'] || 0) / 35000) * 100)),
        },
        food: {
          qty: `${(d.inventory['food'] || 0).toLocaleString()} kg`,
          pct: Math.min(100, Math.round(((d.inventory['food'] || 0) / 25000) * 100)),
        },
        fuel: {
          qty: `${(d.inventory['fuel'] || 0).toLocaleString()} L`,
          pct: Math.min(100, Math.round(((d.inventory['fuel'] || 0) / 20000) * 100)),
        },
        equipment: {
          qty: `${(d.inventory['equipment'] || 0).toLocaleString()} kits`,
          pct: Math.min(100, Math.round(((d.inventory['equipment'] || 0) / 10000) * 100)),
        },
      },
    };
  });

  const currentDepot = displayDepots[selectedDepotIndex] || displayDepots[0];

  if (loading && displayDepots.length === 0) {
    return (
      <Panel
        title="Inventory Status"
        subtitle="Synchronizing (/api/depots)..."
        icon={<Boxes className="w-4 h-4 text-cyan-400" />}
        badge={<StatusBadge label="SYNCING" variant="info" size="sm" />}
        bodyClassName="p-6 flex items-center justify-center min-h-[220px]"
      >
        <div className="flex flex-col items-center justify-center gap-2 text-slate-500 font-mono text-xs">
          <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
          <span>Loading depot inventory telemetry...</span>
        </div>
      </Panel>
    );
  }

  if (displayDepots.length === 0) {
    return (
      <Panel
        title="Inventory Status"
        subtitle="0 Regional Relief Depots (/api/state)"
        icon={<Boxes className="w-4 h-4 text-cyan-400" />}
        badge={<StatusBadge label="NO DATA" variant="warning" size="sm" />}
        bodyClassName="p-6 flex items-center justify-center min-h-[220px]"
      >
        <div className="flex flex-col items-center justify-center gap-2 text-slate-500 font-mono text-xs">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          <span>No depot inventories registered.</span>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Inventory Status"
      subtitle={`${displayDepots.length} Regional Relief Depots (/api/state)`}
      icon={<Boxes className="w-4 h-4 text-cyan-400" />}
      badge={<StatusBadge label="STOCK SYNCED" variant="info" size="sm" />}
      headerRight={
        <div className="flex items-center gap-1 bg-slate-950 rounded p-0.5 border border-slate-800 text-[10px] font-mono">
          {displayDepots.map((d, idx) => (
            <button
              key={d.id}
              onClick={() => setSelectedDepotIndex(idx)}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                selectedDepotIndex === idx
                  ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {d.id.replace('DEPOT-', '')}
            </button>
          ))}
        </div>
      }
      bodyClassName="p-3.5 space-y-3"
    >
      {/* Active Depot Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 font-mono text-xs">
        <div>
          <div className="font-bold text-slate-100">{currentDepot.name}</div>
          <div className="text-[10px] text-slate-500">{currentDepot.id}</div>
        </div>
        <div className="text-right">
          <div className="text-cyan-400 font-bold">{currentDepot.utilization}%</div>
          <div className="text-[10px] text-slate-500">CAPACITY</div>
        </div>
      </div>

      {/* Stock items with progress gauges */}
      <div className="space-y-2.5 font-mono text-xs">
        {/* Medicine */}
        <div>
          <div className="flex justify-between items-center text-[11px] mb-1">
            <span className="text-slate-400 flex items-center gap-1.5">
              <HeartPulse className="w-3 h-3 text-rose-400" /> Medicine
            </span>
            <span className="text-slate-200 font-bold">
              {currentDepot.supplies.medicine.qty}
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-rose-500 rounded-full"
              style={{ width: `${currentDepot.supplies.medicine.pct}%` }}
            />
          </div>
        </div>

        {/* Potable Water */}
        <div>
          <div className="flex justify-between items-center text-[11px] mb-1">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Droplets className="w-3 h-3 text-cyan-400" /> Clean Water
            </span>
            <span className="text-slate-200 font-bold">
              {currentDepot.supplies.water.qty}
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 rounded-full"
              style={{ width: `${currentDepot.supplies.water.pct}%` }}
            />
          </div>
        </div>

        {/* Food Rations */}
        <div>
          <div className="flex justify-between items-center text-[11px] mb-1">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Package className="w-3 h-3 text-amber-400" /> Food Rations
            </span>
            <span className="text-slate-200 font-bold">
              {currentDepot.supplies.food.qty}
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full"
              style={{ width: `${currentDepot.supplies.food.pct}%` }}
            />
          </div>
        </div>

        {/* Fuel */}
        <div>
          <div className="flex justify-between items-center text-[11px] mb-1">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Fuel className="w-3 h-3 text-emerald-400" /> Fleet Diesel
            </span>
            <span className="text-slate-200 font-bold">
              {currentDepot.supplies.fuel.qty}
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${currentDepot.supplies.fuel.pct}%` }}
            />
          </div>
        </div>

        {/* Equipment */}
        <div>
          <div className="flex justify-between items-center text-[11px] mb-1">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Wrench className="w-3 h-3 text-slate-400" /> Rescue Equipment
            </span>
            <span className="text-slate-200 font-bold">
              {currentDepot.supplies.equipment.qty}
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-500 rounded-full"
              style={{ width: `${currentDepot.supplies.equipment.pct}%` }}
            />
          </div>
        </div>
      </div>
    </Panel>
  );
};

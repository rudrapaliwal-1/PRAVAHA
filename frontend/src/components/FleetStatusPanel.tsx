import React from 'react';
import { Truck, AlertCircle, RefreshCw } from 'lucide-react';
import { Panel } from './Panel';
import { StatusBadge, StatusVariant } from './StatusBadge';
import { Vehicle } from '../types';

interface FleetStatusPanelProps {
  vehicles?: Vehicle[];
  loading?: boolean;
}

export const FleetStatusPanel: React.FC<FleetStatusPanelProps> = ({ vehicles, loading = false }) => {
  const displayVehicles = (vehicles || []).map((v) => ({
    id: v.id,
    model: `${v.capacity >= 8000 ? 'Heavy 4x4' : v.capacity >= 4000 ? 'Medium Carrier' : 'Light Rapid Unit'} (${(v.capacity / 1000).toFixed(1)}T)`,
    mission: v.available ? 'Ready for Dispatch' : 'Active Relief Mission',
    location: `${v.current_location.lat.toFixed(2)}°N, ${v.current_location.lon.toFixed(2)}°E`,
    fuel: v.fuel_level,
    speed: `${v.speed} km/h`,
    status: (v.available ? 'AVAILABLE' : 'IN TRANSIT') as 'AVAILABLE' | 'IN TRANSIT',
    variant: (v.available ? 'success' : 'info') as StatusVariant,
  }));

  const availableCount = displayVehicles.filter((v) => v.status === 'AVAILABLE').length;

  return (
    <Panel
      title="Fleet Status Matrix"
      subtitle={`${displayVehicles.length} Units Telemetry (/api/state)`}
      icon={<Truck className="w-4 h-4 text-cyan-400" />}
      badge={<StatusBadge label={`${availableCount} / ${displayVehicles.length}`} variant="success" size="sm" />}
      headerRight={
        <span className="text-[10px] font-mono text-slate-500">LIVE FEED</span>
      }
      bodyClassName="p-0 overflow-x-auto"
    >
      <div className="min-w-[420px]">
        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 text-[10px] uppercase">
            <tr>
              <th className="py-2.5 px-3">VEHICLE</th>
              <th className="py-2.5 px-3">MISSION / ROUTE</th>
              <th className="py-2.5 px-3">FUEL</th>
              <th className="py-2.5 px-3">SPEED</th>
              <th className="py-2.5 px-3 text-right">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40 text-[11px] text-slate-300">
            {loading && displayVehicles.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    <span>Synchronizing vehicle telemetry...</span>
                  </div>
                </td>
              </tr>
            ) : displayVehicles.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-slate-600" />
                    <span>No vehicles registered in telemetry feed.</span>
                  </div>
                </td>
              </tr>
            ) : (
              displayVehicles.map((v) => (
                <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-cyan-400">{v.id}</div>
                    <div className="text-[10px] text-slate-500 truncate max-w-[110px]">{v.model}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="text-slate-200 truncate max-w-[140px] font-semibold">
                      {v.mission}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                      {v.location}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full ${
                            v.fuel > 50
                              ? 'bg-emerald-500'
                              : v.fuel > 25
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${v.fuel}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400">{v.fuel}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                    {v.speed}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <StatusBadge label={v.status} variant={v.variant} size="sm" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
};

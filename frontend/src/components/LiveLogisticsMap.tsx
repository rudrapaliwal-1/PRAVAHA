import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Layers,
  Crosshair,
  Maximize2,
  Minimize2,
  Compass,
  Truck,
  Boxes,
  Users,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { LogisticsState, Vehicle, Depot, DemandPoint, Route } from '../types';

interface LiveLogisticsMapProps {
  state: LogisticsState | null;
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
  heightClass?: string;
  highlightedRoutes?: string[];
  highlightedVehicles?: string[];
}

export const LiveLogisticsMap: React.FC<LiveLogisticsMapProps> = ({
  state,
  loading = false,
  onRefresh,
  className = '',
  heightClass = 'h-[520px] xl:h-[560px]',
  highlightedRoutes = [],
  highlightedVehicles = [],
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupsRef = useRef<maplibregl.Popup[]>([]);

  const [layers, setLayers] = useState({
    depots: true,
    vehicles: true,
    demand: true,
    routes: true,
    blockedRoutes: true,
  });

  const [mapLoaded, setMapLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number }>({
    lat: 30.3165,
    lon: 78.0322,
  });

  const mapStyleUrl =
    import.meta.env.VITE_MAP_STYLE ||
    'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

  // Toggle layer visibility
  const toggleLayer = (key: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 1. Initialize MapLibre GL instance
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapStyleUrl,
      center: [78.2, 30.3], // Uttarakhand operational center
      zoom: 9.2,
      pitch: 35,
      bearing: -15,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    map.on('error', (e: any) => {
      // Gracefully handle tile loading interruptions (e.g. offline simulation)
      console.debug('MapLibre event handled:', e?.error?.message || e);
    });

    map.on('mousemove', (e: any) => {
      setCursorCoords({
        lat: parseFloat(e.lngLat.lat.toFixed(4)),
        lon: parseFloat(e.lngLat.lng.toFixed(4)),
      });
    });

    map.on('load', () => {
      setMapLoaded(true);
      mapRef.current = map;
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      map.remove();
    };
  }, [mapStyleUrl]);

  // Handle window resizing and fullscreen changes
  useEffect(() => {
    const handleResize = () => {
      mapRef.current?.resize();
    };
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(() => {
      mapRef.current?.resize();
    }, 250);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [fullscreen]);

  // 2. Render route vector layers and markers whenever state or layer toggles update
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !state) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Clear existing popups
    popupsRef.current.forEach((p) => p.remove());
    popupsRef.current = [];

    const bounds = new maplibregl.LngLatBounds();
    let hasCoords = false;

    // -------------------------------------------------------------------------
    // A. ROUTES (Active & Blocked)
    // -------------------------------------------------------------------------
    const activeRouteFeatures: any[] = [];
    const blockedRouteFeatures: any[] = [];
    const reoptimizedRouteFeatures: any[] = [];

    Object.values(state.routes || {}).forEach((route: Route) => {
      if (!route.source || !route.destination) return;

      const isReoptimized = highlightedRoutes.includes(route.id);

      const feature = {
        type: 'Feature',
        properties: {
          id: route.id,
          distance: route.distance,
          travel_time: route.travel_time,
          risk: route.risk,
          available: route.available,
          isReoptimized,
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [route.source.lon, route.source.lat],
            [route.destination.lon, route.destination.lat],
          ],
        },
      };

      if (!route.available) {
        blockedRouteFeatures.push(feature);
      } else if (isReoptimized) {
        reoptimizedRouteFeatures.push(feature);
      } else {
        activeRouteFeatures.push(feature);
      }

      bounds.extend([route.source.lon, route.source.lat]);
      bounds.extend([route.destination.lon, route.destination.lat]);
      hasCoords = true;
    });

    // Update or add GeoJSON source for reoptimized routes
    const reoptSource = map.getSource('reoptimized-routes') as maplibregl.GeoJSONSource;
    if (reoptSource) {
      reoptSource.setData({
        type: 'FeatureCollection',
        features: reoptimizedRouteFeatures,
      });
    } else {
      map.addSource('reoptimized-routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: reoptimizedRouteFeatures },
      });

      map.addLayer({
        id: 'reoptimized-routes-glow',
        type: 'line',
        source: 'reoptimized-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#10b981',
          'line-width': 8,
          'line-opacity': 0.5,
        },
      });

      map.addLayer({
        id: 'reoptimized-routes-line',
        type: 'line',
        source: 'reoptimized-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#34d399',
          'line-width': 4,
          'line-opacity': 1.0,
        },
      });
    }

    // Update or add GeoJSON source for active routes
    const activeSource = map.getSource('active-routes') as maplibregl.GeoJSONSource;
    if (activeSource) {
      activeSource.setData({
        type: 'FeatureCollection',
        features: layers.routes ? activeRouteFeatures : [],
      });
    } else {
      map.addSource('active-routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: activeRouteFeatures },
      });

      map.addLayer({
        id: 'active-routes-glow',
        type: 'line',
        source: 'active-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#06b6d4',
          'line-width': 5,
          'line-opacity': 0.35,
        },
      });

      map.addLayer({
        id: 'active-routes-line',
        type: 'line',
        source: 'active-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#22d3ee',
          'line-width': 2.5,
          'line-opacity': 0.85,
        },
      });
    }

    // Update or add GeoJSON source for blocked routes
    const blockedSource = map.getSource('blocked-routes') as maplibregl.GeoJSONSource;
    if (blockedSource) {
      blockedSource.setData({
        type: 'FeatureCollection',
        features: layers.blockedRoutes ? blockedRouteFeatures : [],
      });
    } else {
      map.addSource('blocked-routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: blockedRouteFeatures },
      });

      map.addLayer({
        id: 'blocked-routes-glow',
        type: 'line',
        source: 'blocked-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#ef4444',
          'line-width': 7,
          'line-opacity': 0.4,
        },
      });

      map.addLayer({
        id: 'blocked-routes-line',
        type: 'line',
        source: 'blocked-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#f87171',
          'line-width': 3,
          'line-dasharray': [3, 2],
          'line-opacity': 0.95,
        },
      });
    }

    // -------------------------------------------------------------------------
    // B. DEPOTS MARKERS
    // -------------------------------------------------------------------------
    if (layers.depots) {
      Object.values(state.depots || {}).forEach((depot: Depot) => {
        const totalStock = Object.values(depot.inventory || {}).reduce((a, b) => a + b, 0);

        const el = document.createElement('div');
        el.className = 'group cursor-pointer';
        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-cyan-400 opacity-60"></span>
            <div class="w-7 h-7 rounded-lg bg-slate-950 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.8)] z-10">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div class="absolute -bottom-5 font-mono text-[9px] font-bold text-cyan-300 bg-slate-950/90 px-1 rounded border border-cyan-500/40 whitespace-nowrap">
              ${depot.id}
            </div>
          </div>
        `;

        // Popup Content
        const inventoryRows = Object.entries(depot.inventory || {})
          .map(
            ([type, qty]) => `
            <div class="flex justify-between items-center text-[10px] py-0.5 border-b border-slate-800">
              <span class="text-slate-400 uppercase">${type}:</span>
              <span class="font-bold text-slate-200">${qty.toLocaleString()} kg</span>
            </div>
          `,
          )
          .join('');

        const popupHtml = `
          <div class="p-3 bg-slate-950 border border-cyan-500/50 rounded-lg font-mono text-slate-200 min-w-[210px] shadow-2xl">
            <div class="flex items-center justify-between pb-1.5 border-b border-slate-800 mb-2">
              <span class="font-bold text-cyan-400 text-xs">${depot.id}</span>
              <span class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40">OPERATIONAL</span>
            </div>
            <div class="text-[10px] text-slate-400 mb-2">
              <div>GPS: ${depot.location.lat.toFixed(4)}°N, ${depot.location.lon.toFixed(4)}°E</div>
              <div class="text-cyan-300 font-semibold mt-1">Total Stock: ${totalStock.toLocaleString()} kg</div>
              <div class="text-slate-400">Available Capacity: 85,000 kg</div>
            </div>
            <div class="space-y-1">
              <div class="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Inventory Breakdown:</div>
              ${inventoryRows}
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(popupHtml);
        popupsRef.current.push(popup);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([depot.location.lon, depot.location.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
        bounds.extend([depot.location.lon, depot.location.lat]);
        hasCoords = true;
      });
    }

    // -------------------------------------------------------------------------
    // C. VEHICLES MARKERS
    // -------------------------------------------------------------------------
    if (layers.vehicles) {
      Object.values(state.vehicles || {}).forEach((vehicle: Vehicle) => {
        const isAvail = vehicle.available;
        const isReassigned = highlightedVehicles.includes(vehicle.id);
        const color = isReassigned ? '#34d399' : isAvail ? '#10b981' : '#f59e0b';

        const el = document.createElement('div');
        el.className = 'group cursor-pointer';
        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            ${
              isReassigned
                ? '<div class="absolute -top-4.5 font-mono text-[8px] font-extrabold text-emerald-300 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-400 whitespace-nowrap shadow-glow-green animate-bounce z-20">REASSIGNED</div>'
                : ''
            }
            <span class="animate-ping absolute inline-flex h-6 w-6 rounded-full" style="background-color: ${color}; opacity: 0.5;"></span>
            <div class="w-6 h-6 rounded-full bg-slate-950 border-2 flex items-center justify-center text-white shadow-lg z-10" style="border-color: ${color};">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h2a1 1 0 001-1m-7 0a1 1 0 011-1h2a1 1 0 011 1m-7 0a2 2 0 104 0m8 0a2 2 0 104 0" />
              </svg>
            </div>
            <div class="absolute -bottom-4 font-mono text-[9px] font-bold text-slate-200 bg-slate-950/90 px-1 rounded border border-slate-700 whitespace-nowrap">
              ${vehicle.id}
            </div>
          </div>
        `;

        const statusLabel = vehicle.available ? 'AVAILABLE' : 'IN TRANSIT';
        const currentLoad = (vehicle.capacity * (vehicle.available ? 0 : 0.85)).toFixed(0);
        const etaMinutes = vehicle.available ? '0 mins (Standby)' : '38 mins';

        const popupHtml = `
          <div class="p-3 bg-slate-950 border border-slate-700 rounded-lg font-mono text-slate-200 min-w-[200px] shadow-2xl">
            <div class="flex items-center justify-between pb-1.5 border-b border-slate-800 mb-2">
              <span class="font-bold text-cyan-400 text-xs">${vehicle.id}</span>
              <span class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                vehicle.available
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                  : 'bg-amber-950 text-amber-400 border border-amber-500/40'
              }">${statusLabel}</span>
            </div>
            <div class="space-y-1.5 text-[10px]">
              <div class="flex justify-between">
                <span class="text-slate-400">Capacity:</span>
                <span class="font-bold text-slate-200">${vehicle.capacity.toLocaleString()} kg</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Current Load:</span>
                <span class="font-bold text-cyan-300">${currentLoad} kg</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Speed:</span>
                <span class="font-bold text-slate-200">${vehicle.speed} km/h</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Fuel Level:</span>
                <span class="font-bold ${vehicle.fuel_level < 30 ? 'text-rose-400' : 'text-emerald-400'}">${vehicle.fuel_level}%</span>
              </div>
              <div class="flex justify-between pt-1 border-t border-slate-800/80">
                <span class="text-slate-400">ETA:</span>
                <span class="font-bold text-amber-300">${etaMinutes}</span>
              </div>
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 20, closeButton: false }).setHTML(popupHtml);
        popupsRef.current.push(popup);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([vehicle.current_location.lon, vehicle.current_location.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
        bounds.extend([vehicle.current_location.lon, vehicle.current_location.lat]);
        hasCoords = true;
      });
    }

    // -------------------------------------------------------------------------
    // D. DEMAND POINTS MARKERS
    // -------------------------------------------------------------------------
    if (layers.demand) {
      Object.values(state.demand_points || {}).forEach((dp: DemandPoint) => {
        const isCritical = dp.priority === 'critical';
        const isHigh = dp.priority === 'high';
        const color = isCritical ? '#f43f5e' : isHigh ? '#f59e0b' : '#38bdf8';

        const el = document.createElement('div');
        el.className = 'group cursor-pointer';
        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute inline-flex h-7 w-7 rounded-full" style="background-color: ${color}; opacity: 0.6;"></span>
            <div class="w-6 h-6 rounded-md bg-slate-950 border-2 flex items-center justify-center text-white shadow-lg z-10" style="border-color: ${color};">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div class="absolute -bottom-4 font-mono text-[9px] font-bold text-slate-200 bg-slate-950/90 px-1 rounded border border-slate-700 whitespace-nowrap">
              ${dp.id}
            </div>
          </div>
        `;

        const requiredRows = Object.entries(dp.required_supplies || {})
          .map(
            ([type, qty]) => `
            <div class="flex justify-between items-center text-[10px] py-0.5 border-b border-slate-800">
              <span class="text-slate-400 uppercase">${type}:</span>
              <span class="font-bold text-amber-300">${qty.toLocaleString()} kg</span>
            </div>
          `,
          )
          .join('');

        const shortageRisk = isCritical
          ? 'CRITICAL (< 4h Depletion)'
          : isHigh
          ? 'HIGH (< 8h Depletion)'
          : 'MODERATE (12h+ Buffer)';

        const popupHtml = `
          <div class="p-3 bg-slate-950 border border-slate-700 rounded-lg font-mono text-slate-200 min-w-[210px] shadow-2xl">
            <div class="flex items-center justify-between pb-1.5 border-b border-slate-800 mb-2">
              <span class="font-bold text-rose-400 text-xs">${dp.id}</span>
              <span class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase" style="color: ${color}; border: 1px solid ${color};">
                ${dp.priority.toUpperCase()}
              </span>
            </div>
            <div class="text-[10px] text-slate-400 mb-2">
              <div>Location: ${dp.location.lat.toFixed(4)}°N, ${dp.location.lon.toFixed(4)}°E</div>
              <div class="mt-1 font-semibold text-rose-300">Shortage Risk: ${shortageRisk}</div>
            </div>
            <div class="space-y-1">
              <div class="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Required Supply:</div>
              ${requiredRows || '<div class="text-slate-500 text-[10px]">No supplies requested</div>'}
            </div>
          </div>
        `;

        const popup = new maplibregl.Popup({ offset: 20, closeButton: false }).setHTML(popupHtml);
        popupsRef.current.push(popup);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([dp.location.lon, dp.location.lat])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
        bounds.extend([dp.location.lon, dp.location.lat]);
        hasCoords = true;
      });
    }

    // Fit map bounds to encompass all points if coords exist
    if (hasCoords) {
      map.fitBounds(bounds, { padding: 45, maxZoom: 11.5, duration: 800 });
    }
  }, [state, mapLoaded, layers]);

  // Recenter helper
  const handleRecenter = () => {
    if (!mapRef.current || !state) return;
    const bounds = new maplibregl.LngLatBounds();
    let count = 0;

    Object.values(state.depots || {}).forEach((d) => {
      bounds.extend([d.location.lon, d.location.lat]);
      count++;
    });
    Object.values(state.demand_points || {}).forEach((dp) => {
      bounds.extend([dp.location.lon, dp.location.lat]);
      count++;
    });
    Object.values(state.vehicles || {}).forEach((v) => {
      bounds.extend([v.current_location.lon, v.current_location.lat]);
      count++;
    });

    if (count > 0) {
      mapRef.current.fitBounds(bounds, { padding: 50, duration: 900 });
    }
  };

  return (
    <div
      className={`relative bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col shadow-sm backdrop-blur transition-all duration-300 ${
        fullscreen ? 'fixed inset-4 z-50 rounded-xl border-cyan-500/50 shadow-2xl' : heightClass
      } ${className}`}
    >
      {/* Top Corner HUD Accent */}
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-500/60 z-20 pointer-events-none" />

      {/* Map Control Toolbar */}
      <div className="px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 z-20 backdrop-blur font-mono text-xs">
        {/* Layer Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Layers:
          </span>

          {/* Depots */}
          <button
            onClick={() => toggleLayer('depots')}
            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 border transition-all ${
              layers.depots
                ? 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300 shadow-glow-cyan'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <Boxes className="w-3 h-3 text-cyan-400" />
            <span>Depots ({Object.keys(state?.depots || {}).length})</span>
          </button>

          {/* Vehicles */}
          <button
            onClick={() => toggleLayer('vehicles')}
            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 border transition-all ${
              layers.vehicles
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300 shadow-glow-green'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <Truck className="w-3 h-3 text-emerald-400" />
            <span>Vehicles ({Object.keys(state?.vehicles || {}).length})</span>
          </button>

          {/* Demand Points */}
          <button
            onClick={() => toggleLayer('demand')}
            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 border transition-all ${
              layers.demand
                ? 'bg-amber-950/70 border-amber-500/40 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <Users className="w-3 h-3 text-amber-400" />
            <span>Demand ({Object.keys(state?.demand_points || {}).length})</span>
          </button>

          {/* Active Routes */}
          <button
            onClick={() => toggleLayer('routes')}
            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 border transition-all ${
              layers.routes
                ? 'bg-cyan-950/50 border-cyan-500/40 text-cyan-400'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="w-2.5 h-0.5 bg-cyan-400 rounded-full" />
            <span>Active Routes</span>
          </button>

          {/* Blocked Routes */}
          <button
            onClick={() => toggleLayer('blockedRoutes')}
            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 border transition-all ${
              layers.blockedRoutes
                ? 'bg-rose-950/70 border-rose-500/40 text-rose-300 shadow-glow-red'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            <span>Blocked Routes</span>
          </button>
        </div>

        {/* View Controls & Live Connection Pill */}
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded bg-slate-900 border border-slate-700 text-slate-400 hover:text-cyan-400 transition-colors"
              title="Refresh /api/state telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          )}

          <button
            onClick={handleRecenter}
            className="p-1.5 rounded bg-slate-900 border border-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Recenter Map Viewport"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-1.5 rounded bg-slate-900 border border-slate-700 text-slate-400 hover:text-white transition-colors"
            title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen Map'}
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* MapLibre DOM Container */}
      <div className="relative flex-1 bg-slate-950 overflow-hidden">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

        {/* HUD Coordinate Stamp (Top Left) */}
        <div className="absolute top-3 left-3 bg-slate-950/85 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-[10px] text-slate-400 space-y-0.5 pointer-events-none backdrop-blur z-10">
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
            <Compass className="w-3 h-3" />
            <span>MAPLIBRE GL // LIVE VECTOR</span>
          </div>
          <div>CURSOR: {cursorCoords.lat}°N, {cursorCoords.lon}°E</div>
          <div className="text-slate-500">PROJECTION: EPSG:3857 (WGS-84)</div>
        </div>

        {/* HUD Live Feed Stamp (Bottom Right) */}
        <div className="absolute bottom-3 right-3 bg-slate-950/85 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-[10px] text-slate-400 space-y-0.5 pointer-events-none backdrop-blur z-10">
          <div className="flex items-center justify-between gap-3">
            <span>BACKEND: /api/state</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE CONNECTED
            </span>
          </div>
          <div className="text-slate-500">
            {Object.keys(state?.vehicles || {}).length} Vehicles • {Object.keys(state?.depots || {}).length} Depots • {Object.keys(state?.demand_points || {}).length} Demand Sites
          </div>
        </div>
      </div>
    </div>
  );
};

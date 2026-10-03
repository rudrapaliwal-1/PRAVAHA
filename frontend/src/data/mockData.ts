export interface MockVehicle {
  id: string;
  model: string;
  driver: string;
  capacity: string;
  fuel: number;
  speed: string;
  location: string;
  mission: string;
  status: 'IN TRANSIT' | 'AVAILABLE' | 'REFUELING' | 'MAINTENANCE';
  variant: 'info' | 'success' | 'warning' | 'danger';
}

export interface MockDepotStock {
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

export interface MockAlert {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  location: string;
  actionLabel: string;
}

export interface MockTimelineEvent {
  id: string;
  time: string;
  type: 'dispatch' | 'disruption' | 'delivery' | 'inventory' | 'copilot';
  title: string;
  detail: string;
  badgeText: string;
  badgeVariant: 'success' | 'warning' | 'danger' | 'info';
}

export const mockDashboardData = {
  kpis: {
    activeVehicles: {
      value: '24',
      unit: '/ 28 TOTAL',
      change: '+4 dispatched',
      changeType: 'positive' as const,
      statusText: '85.7% READY',
      statusVariant: 'success' as const,
      subtext: '16 en route • 8 standby pool',
      progress: 85.7,
    },
    deliveries: {
      value: '142',
      unit: '/ 160 MISSIONS',
      change: '88.8% fulfill',
      changeType: 'positive' as const,
      statusText: 'ON SCHEDULE',
      statusVariant: 'success' as const,
      subtext: '18 active in pipeline',
      progress: 88.8,
    },
    availableInventory: {
      value: '76.5',
      unit: 'TONNES',
      change: '5 Depots',
      changeType: 'neutral' as const,
      statusText: 'ADEQUATE',
      statusVariant: 'info' as const,
      subtext: '7.4 days buffer reserve',
      progress: 82.0,
    },
    criticalShortages: {
      value: '3',
      unit: 'SECTORS (P1)',
      change: 'Resupply < 4h',
      changeType: 'negative' as const,
      statusText: 'ELEVATED',
      statusVariant: 'danger' as const,
      subtext: 'Tehri, Dharasu, Joshimath',
      progress: 75.0,
      alert: true,
    },
    activeDisruptions: {
      value: '3',
      unit: 'HAZARDS ACTIVE',
      change: 'Bypasses Live',
      changeType: 'negative' as const,
      statusText: 'MONITORED',
      statusVariant: 'warning' as const,
      subtext: '1 Landslide • 1 Flood • 1 Fault',
      progress: 60.0,
    },
    averageEta: {
      value: '42',
      unit: 'MINS',
      change: '-8m solver delta',
      changeType: 'positive' as const,
      statusText: 'OPTIMIZED',
      statusVariant: 'success' as const,
      subtext: 'Target corridor clearance < 50m',
      progress: 84.0,
    },
    resilienceScore: {
      value: '91.4',
      unit: '/ 100',
      change: '+2.1 pts',
      changeType: 'positive' as const,
      statusText: 'ROBUST',
      statusVariant: 'success' as const,
      subtext: 'Zero single point of failure',
      progress: 91.4,
    },
  },

  fleet: [
    {
      id: 'VEH-01',
      model: 'Ashok Leyland 4x4 Heavy (8T)',
      driver: 'Hav. R. Sharma',
      capacity: '8,000 kg',
      fuel: 92,
      speed: '58 km/h',
      location: 'NH-58 Devprayag Bypass',
      mission: 'MSN-7041 (Medical Delivery)',
      status: 'IN TRANSIT',
      variant: 'info',
    },
    {
      id: 'VEH-02',
      model: 'Tata LPTA 715 All-Terrain (3T)',
      driver: 'Naik S. Rawat',
      capacity: '3,000 kg',
      fuel: 78,
      speed: '44 km/h',
      location: 'Dharasu Route 94 Link',
      mission: 'MSN-7042 (Rations & Shelter)',
      status: 'IN TRANSIT',
      variant: 'info',
    },
    {
      id: 'VEH-03',
      model: 'Mahindra Marksman Light (1.5T)',
      driver: 'Sep. V. Negi',
      capacity: '1,500 kg',
      fuel: 96,
      speed: '0 km/h',
      location: 'Depot Alpha (Dehradun)',
      mission: 'Rapid Recon Contingency',
      status: 'AVAILABLE',
      variant: 'success',
    },
    {
      id: 'VEH-04',
      model: 'Ashok Leyland Stallion (5T)',
      driver: 'Hav. P. Joshi',
      capacity: '5,000 kg',
      fuel: 34,
      speed: '0 km/h',
      location: 'Depot Beta (Rishikesh)',
      mission: 'Scheduled Fuel Refill Bay 2',
      status: 'REFUELING',
      variant: 'warning',
    },
    {
      id: 'VEH-05',
      model: 'BEML Heavy Hauler 8x8 (12T)',
      driver: 'Sub. K. Singh',
      capacity: '12,000 kg',
      fuel: 61,
      speed: '0 km/h',
      location: 'Base Repair Workshop',
      mission: 'Hydraulic Seal Overhaul',
      status: 'MAINTENANCE',
      variant: 'danger',
    },
  ] as MockVehicle[],

  depots: [
    {
      id: 'DEPOT-ALPHA',
      name: 'Dehradun Central Relief Hub',
      utilization: 84,
      supplies: {
        medicine: { qty: '6,000 units', pct: 86 },
        water: { qty: '30,000 L', pct: 90 },
        food: { qty: '22,000 kg', pct: 78 },
        fuel: { qty: '18,000 L', pct: 82 },
        equipment: { qty: '5,000 kits', pct: 75 },
      },
    },
    {
      id: 'DEPOT-BETA',
      name: 'Rishikesh Forward Logistics Base',
      utilization: 72,
      supplies: {
        medicine: { qty: '4,500 units', pct: 75 },
        water: { qty: '24,000 L', pct: 80 },
        food: { qty: '18,500 kg', pct: 70 },
        fuel: { qty: '14,000 L', pct: 68 },
        equipment: { qty: '3,800 kits', pct: 65 },
      },
    },
    {
      id: 'DEPOT-GAMMA',
      name: 'Uttarkashi Mountain Outpost',
      utilization: 91,
      supplies: {
        medicine: { qty: '1,800 units', pct: 45 },
        water: { qty: '12,000 L', pct: 55 },
        food: { qty: '9,200 kg', pct: 60 },
        fuel: { qty: '6,500 L', pct: 52 },
        equipment: { qty: '1,400 kits', pct: 48 },
      },
    },
  ] as MockDepotStock[],

  alerts: [
    {
      id: 'ALT-101',
      title: 'Landslide Obstruction on NH-58',
      description: 'Massive debris block near Devprayag. Corridor blocked for heavy vehicles. Google OR-Tools dynamic reroute via Bypass-7B active.',
      severity: 'critical',
      timestamp: '14m ago',
      location: 'NH-58 Km Marker 74',
      actionLabel: 'View Bypass Plan #809',
    },
    {
      id: 'ALT-102',
      title: 'Flash Flood Warning — Mandakini Basin',
      description: 'River discharge level +1.8m above safety datum. Low-lying crossing closed; convoys rerouted over upper ridge bridge.',
      severity: 'high',
      timestamp: '42m ago',
      location: 'Rudraprayag Sector C',
      actionLabel: 'Inspect Weather Radar',
    },
    {
      id: 'ALT-103',
      title: 'High Burn-Rate Alert: Depot Gamma Medicine',
      description: 'Trauma medicine consumption running at 145% of forecasted volume due to sudden surge in Sector 4 admissions.',
      severity: 'medium',
      timestamp: '1h 10m ago',
      location: 'Depot Gamma (Uttarkashi)',
      actionLabel: 'Schedule Emergency Resupply',
    },
  ] as MockAlert[],

  timeline: [
    {
      id: 'EVT-01',
      time: '11:42:10 UTC',
      type: 'dispatch',
      title: 'Convoy MSN-7041 Dispatched',
      detail: 'VEH-01 departed Depot Alpha carrying 1.2T medicine & 4T water destined for Tehri Garhwal.',
      badgeText: 'DISPATCH',
      badgeVariant: 'info',
    },
    {
      id: 'EVT-02',
      time: '11:35:45 UTC',
      type: 'disruption',
      title: 'Dynamic Reroute Approved (COA-1)',
      detail: 'Operator-01 authorized bypass detour around NH-58 landslide. ETA increased by 22 minutes.',
      badgeText: 'SOLVER RE-OPT',
      badgeVariant: 'warning',
    },
    {
      id: 'EVT-03',
      time: '11:18:20 UTC',
      type: 'delivery',
      title: 'Relief Payload Delivered to Dharasu',
      detail: 'Convoy MSN-7038 successfully handed over 3,000kg food rations to field medical team.',
      badgeText: 'DELIVERED',
      badgeVariant: 'success',
    },
    {
      id: 'EVT-04',
      time: '10:55:00 UTC',
      type: 'inventory',
      title: 'Strategic Stock Inflow at Depot Alpha',
      detail: 'Inbound airlift delivered 12,000L purified water tankers and 2,000 surgical antibiotic kits.',
      badgeText: 'STOCK RESTOCK',
      badgeVariant: 'info',
    },
    {
      id: 'EVT-05',
      time: '10:30:15 UTC',
      type: 'copilot',
      title: 'Copilot Predictive Alert Issued',
      detail: 'Identified projected shortage in Sector 2 within 6 hours. Generated preemptive replenishment recommendation.',
      badgeText: 'AI INTEL',
      badgeVariant: 'success',
    },
  ] as MockTimelineEvent[],

  copilot: {
    history: [
      {
        sender: 'operator',
        time: '11:22 UTC',
        text: 'Assess impact if NH-58 remains blocked for next 6 hours. Can Depot Alpha sustain P1 sites?',
      },
      {
        sender: 'copilot',
        time: '11:23 UTC',
        text: 'Depot Alpha has 76.5T aggregate inventory. With NH-58 detour active via Bypass-7B, fleet transit increases by +34 minutes, but all 3 P1 sites (Tehri, Dharasu, Joshimath) remain 100% reachable within critical safety margins. No stockouts expected before 22:00 UTC.',
      },
    ],
    prompts: [
      'Show optimal resupply route to DEMAND-01 (Tehri)',
      'Calculate fuel burn if 4 standby trucks deploy',
      'What is the quickest safe corridor around Mandakini?',
      'Check single-point-of-failure risk on Chamoli Bridge',
    ],
  },
};

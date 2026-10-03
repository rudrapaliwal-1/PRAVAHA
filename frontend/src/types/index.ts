/**
 * MissionPath Command Center - Comprehensive TypeScript Definitions
 * Aligned strictly with Person 1 FastAPI Backend schemas (docs/API.md)
 */

export type NavigationTab =
  | 'dashboard'
  | 'live-map'
  | 'fleet'
  | 'inventory'
  | 'demand'
  | 'optimization'
  | 'disruptions'
  | 'resilience'
  | 'ai-copilot';

export interface NavItemConfig {
  id: NavigationTab;
  label: string;
  shortLabel?: string;
  badge?: string | number;
  badgeVariant?: 'default' | 'danger' | 'warning' | 'success';
  description: string;
}

export type DEFCONLevel = 1 | 2 | 3 | 4 | 5;

// ---------------------------------------------------------------------------
// Backend Core Primitive Schemas
// ---------------------------------------------------------------------------

export interface Location {
  lat: number;
  lon: number;
}

export type SupplyType =
  | 'food'
  | 'water'
  | 'medicine'
  | 'ammunition'
  | 'fuel'
  | 'equipment'
  | 'personnel'
  | 'other';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type DeliveryStatus =
  | 'pending'
  | 'in_transit'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'blocked';

export interface HealthResponse {
  status: string;
  service: string;
}

export interface Vehicle {
  id: string;
  capacity: number;
  current_location: Location;
  available: boolean;
  fuel_level: number;
  speed: number;
}

export interface Depot {
  id: string;
  location: Location;
  inventory: Record<string, number>;
}

export interface DemandPoint {
  id: string;
  location: Location;
  required_supplies: Record<string, number>;
  current_inventory?: Record<string, number>;
  priority: Priority;
  deadline?: string | null;
  consumption_rate?: Record<string, number>;
}

export interface Route {
  id: string;
  source: Location;
  destination: Location;
  distance: number;
  travel_time: number;
  risk: RiskLevel;
  available: boolean;
}

export interface Delivery {
  id: string;
  vehicle_id: string;
  source_id: string;
  destination_id: string;
  supplies: Record<string, number>;
  status: DeliveryStatus;
  start_time?: string | null;
  eta?: string | null;
}

export interface LogisticsState {
  vehicles: Record<string, Vehicle>;
  depots: Record<string, Depot>;
  demand_points: Record<string, DemandPoint>;
  routes: Record<string, Route>;
  deliveries: Delivery[];
  timestamp?: string | null;
}

// ---------------------------------------------------------------------------
// Prediction & Shortage Schemas
// ---------------------------------------------------------------------------
// Prediction & Shortage Schemas
// ---------------------------------------------------------------------------

export type ShortageSeverity = 'critical' | 'high' | 'medium' | 'low' | 'none';

export interface SupplyPrediction {
  supply_type: string;
  current_requirement: number;
  consumption_rate: number;
  predicted_demand: number;
  estimated_time_to_shortage?: number | null;
  shortage_severity: ShortageSeverity | string;
  prediction_confidence?: number;
}

export interface DemandPointPrediction {
  demand_point_id: string;
  priority: Priority;
  deadline?: string | null;
  time_horizon_hours: number;
  predictions: Record<string, SupplyPrediction>;
  highest_severity: ShortageSeverity | string;
  recommended_urgency_score: number;
}

export interface PredictionItem {
  demand_point_id: string;
  supply_type: string;
  current_stock?: number;
  burn_rate_per_hour?: number;
  estimated_depletion_hours?: number | null;
  critical_threshold_hours?: number;
  status?: 'critical' | 'warning' | 'normal';
}

export interface PredictionResponse {
  time_horizon_hours?: number;
  generated_at: string;
  total_demand_points?: number;
  predictions?: Record<string, DemandPointPrediction> | PredictionItem[];
  critical_shortage_count?: number;
  total_predicted_demand?: Record<string, number>;
}

export interface ShortageItem {
  demand_point_id: string;
  supply_type: string;
  current_available?: number;
  consumption_rate?: number;
  time_to_shortage?: number | null;
  predicted_shortage?: number;
  severity: ShortageSeverity | string;
  recommended_resupply_quantity?: number;
  priority?: Priority;
  deadline?: string | null;
  urgency_score?: number;
  // legacy/fallback fields
  shortage_quantity?: number;
  hours_until_depleted?: number;
  urgency?: 'critical' | 'high' | 'medium';
}

export interface ShortageResponse {
  generated_at: string;
  horizon_hours?: number;
  total_shortages_detected?: number;
  critical_shortages_count?: number;
  high_shortages_count?: number;
  shortages: ShortageItem[];
  total_shortages?: number;
}

// ---------------------------------------------------------------------------
// Optimization & Simulation Schemas
// ---------------------------------------------------------------------------

export interface RouteSegment {
  route_id?: string;
  from_id?: string;
  to_id: string;
  arrival_time?: number;
  distance?: number;
  supplies_delivered?: Record<string, number>;
}

export interface VehicleRoutePlan {
  vehicle_id: string;
  stops: string[];
  segments?: RouteSegment[];
  total_distance: number;
  total_time: number;
  total_load: number;
}

export interface OptimizationResult {
  plan_id: string;
  status: 'optimal' | 'feasible' | 'infeasible';
  vehicle_routes: VehicleRoutePlan[];
  total_distance: number;
  total_travel_time: number;
  objective_value?: number;
  solve_time_seconds?: number;
  unassigned_demand_points?: string[];
}

export type DisruptionType =
  | 'BLOCK_ROUTE'
  | 'VEHICLE_FAILURE'
  | 'DEMAND_SURGE'
  | 'INVENTORY_SHORTAGE'
  | 'NEW_EMERGENCY';

export interface DisruptionRequest {
  type: DisruptionType | string;
  target_id?: string | null;
  parameters?: Record<string, any>;
  // Optional legacy fields
  disruption_type?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, any>;
}

export interface DisruptionResult {
  event_id: string;
  event_type: DisruptionType | string;
  affected_entities: string[];
  state_changes: Record<string, any>;
  timestamp: string;
  // Optional computed/derived impact fields
  affected_routes?: string[];
  affected_vehicles?: string[];
  affected_deliveries?: string[];
  disruption_id?: string;
  type?: string;
  target_id?: string;
  status?: string;
  message?: string;
}

export interface ReoptimizeRequest {
  disruption?: DisruptionRequest;
  state?: LogisticsState | null;
  previous_plan?: OptimizationResult | null;
  weights?: any | null;
  // legacy
  disruption_id?: string;
  focus?: 'speed' | 'safety' | 'efficiency';
}

export interface ReoptimizationResult {
  trigger: string;
  disruption_event?: DisruptionResult | null;
  affected_deliveries: any[];
  affected_vehicles: string[];
  affected_routes: string[];
  previous_eta: number;
  new_eta: number;
  delay: number;
  previous_plan: any;
  new_plan: any;
  unmet_demand: Record<string, Record<string, number>>;
  optimization_status: string;
  // legacy/convenience fields
  plan_id?: string;
  original_plan_id?: string;
  status?: 'optimal' | 'feasible' | 'infeasible';
  vehicle_routes?: VehicleRoutePlan[];
  delta_distance?: number;
  delta_time?: number;
  reassigned_vehicles?: string[];
  reassigned_demand_points?: string[];
  mitigation_strategy?: string;
}

export interface OptimizationDelivery {
  vehicle_id: string;
  depot_id: string;
  demand_point_id: string;
  supply_type: string;
  quantity: number;
  route_id: string;
  distance: number;
  travel_time: number;
  risk: string;
  eta: number;
  deadline?: string | null;
  late_delivery?: boolean;
  priority?: string;
}

export interface CourseOfActionPlan {
  id: string;
  name: 'FASTEST' | 'LOWEST_RISK' | 'RESOURCE_EFFICIENT' | string;
  eta: number;
  distance: number;
  risk: number;
  cost: number;
  unmet_demand: number;
  deliveries: OptimizationDelivery[];
  status?: string;
  description?: string;
  // legacy/fallback fields
  strategy?: 'Fastest' | 'Safest' | 'Efficient' | string;
  total_distance?: number;
  total_time?: number;
  risk_index?: number;
  fuel_estimate?: number;
  vehicle_routes?: VehicleRoutePlan[];
  tradeoff_summary?: string;
}

export type CourseOfAction = CourseOfActionPlan;

export interface CoursesOfActionRequest {
  state?: LogisticsState | null;
  disruption?: DisruptionRequest | null;
}

export interface CoursesOfActionResponse {
  plans?: CourseOfActionPlan[];
  coas?: CourseOfActionPlan[];
  generated_at?: string;
}

// ---------------------------------------------------------------------------
// Resilience & Vehicle Health Schemas
// ---------------------------------------------------------------------------

export interface ResilienceScore {
  overall_score: number;
  inventory?: number;
  fleet?: number;
  routes?: number;
  demand_coverage?: number;
  connectivity?: number;
  inventory_score: number;
  fleet_score: number;
  route_score: number;
  demand_coverage_score: number;
  connectivity_score: number;
  key_factors?: string[];
  status?: 'optimal' | 'moderate' | 'critical' | string;
  key_vulnerabilities?: string[];
  calculated_at: string;
}

export type MaintenanceRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export interface VehicleHealthStatus {
  vehicle_id: string;
  mileage: number;
  utilization: number;
  health_score: number;
  maintenance_risk: MaintenanceRisk;
  available: boolean;
  is_operational: boolean;
  fuel_level: number;
  recommended_action?: string | null;
}

export interface VehicleHealthResponse {
  vehicles: VehicleHealthStatus[];
  total_vehicles: number;
  operational_count: number;
  high_risk_count: number;
  average_health_score: number;
  timestamp: string;
  fleet_health?: VehicleHealthStatus[];
  critical_count?: number;
}

export interface PlanDecisionResponse {
  plan_id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED' | 'approved' | 'rejected' | string;
  message: string;
  decided_at?: string;
  timestamp?: string;
  plan?: any;
  is_active?: boolean;
}

export interface CopilotRequest {
  question: string;
  context?: string | null;
  include_optimization?: boolean;
  include_resilience?: boolean;
  include_shortages?: boolean;
  query?: string;
}

export interface CopilotResponse {
  answer: string;
  referenced_entities?: string[];
  context_summary?: string;
  provider?: string;
  timestamp: string;
  query?: string;
  confidence?: number;
}

export interface DemoRunResponse {
  status: string;
  message: string;
  vehicles_count: number;
  depots_count: number;
  demand_points_count: number;
  resilience_score: number;
}

// ---------------------------------------------------------------------------
// Real-Time Alerts & Timeline Schemas (Block 15)
// ---------------------------------------------------------------------------

export type AlertLevel = 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS';

export type AlertCategory =
  | 'shortage'
  | 'route_blockage'
  | 'vehicle_failure'
  | 'demand_surge'
  | 'reoptimization'
  | 'plan_approval'
  | 'resilience_change';

export interface SystemAlert {
  id: string;
  level: AlertLevel;
  category: AlertCategory;
  title: string;
  description: string;
  timestamp: string;
  location?: string;
  sourceEntityId?: string;
  acknowledged?: boolean;
}

export interface SystemTimelineEvent {
  id: string;
  time: string;
  title: string;
  detail?: string;
  category: AlertCategory | 'dispatch' | 'system';
  level: AlertLevel;
  entityId?: string;
}

// ---------------------------------------------------------------------------
// Connectivity & Low-Bandwidth Schemas (Block 17)
// ---------------------------------------------------------------------------

export type ConnectivityMode = 'ONLINE' | 'LOW_CONNECTIVITY' | 'OFFLINE';

export type SyncStatus = 'idle' | 'syncing' | 'synced';

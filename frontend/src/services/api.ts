/**
 * MissionPath API Service Client
 * Connects frontend directly to Person 1 FastAPI Backend (port 8000).
 * Uses VITE_API_BASE_URL environment variable with fallback to http://localhost:8000.
 */

import {
  HealthResponse,
  LogisticsState,
  Vehicle,
  Depot,
  DemandPoint,
  Route,
  PredictionResponse,
  ShortageResponse,
  OptimizationResult,
  DisruptionRequest,
  DisruptionResult,
  ReoptimizeRequest,
  ReoptimizationResult,
  CoursesOfActionResponse,
  ResilienceScore,
  VehicleHealthResponse,
  PlanDecisionResponse,
  CopilotRequest,
  CopilotResponse,
  DemoRunResponse,
} from '../types';

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export type ConnectivityMode = 'ONLINE' | 'LOW_CONNECTIVITY' | 'OFFLINE';

let activeConnectivityMode: ConnectivityMode =
  (typeof window !== 'undefined' && (localStorage.getItem('missionpath_connectivity_mode') as ConnectivityMode)) || 'ONLINE';

export const setApiConnectivityMode = (mode: ConnectivityMode) => {
  activeConnectivityMode = mode;
  if (typeof window !== 'undefined') {
    localStorage.setItem('missionpath_connectivity_mode', mode);
  }
};

export const getApiConnectivityMode = (): ConnectivityMode => {
  return activeConnectivityMode;
};

class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Standard HTTP request wrapper with timeout, JSON parsing, and offline cache
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs = 12000,
): Promise<T> {
  const isMutation = Boolean(options.method && options.method.toUpperCase() !== 'GET');

  // 1. OFFLINE SIMULATION: Block mutations, serve cached GETs
  if (activeConnectivityMode === 'OFFLINE') {
    if (isMutation) {
      throw new ApiError(
        `Operation locked: ${options.method || 'POST'} ${endpoint} requires live backend communication. Simulated offline mode is active.`,
        503,
        { isOffline: true }
      );
    }

    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(`missionpath_cache_${endpoint}`);
      if (cached) {
        try {
          return JSON.parse(cached) as T;
        } catch {
          // fallback to live attempt if cache corrupted
        }
      }
    }
  }

  // 2. LOW CONNECTIVITY SIMULATION: Artificially throttle with 1200ms latency
  if (activeConnectivityMode === 'LOW_CONNECTIVITY') {
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  const defaultHeaders: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (options.body && typeof options.body === 'string') {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(id);

    if (!response.ok) {
      let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson.detail) {
          errorDetail = typeof errorJson.detail === 'string'
            ? errorJson.detail
            : JSON.stringify(errorJson.detail);
        }
      } catch {
        // Fallback to text
      }
      throw new ApiError(errorDetail, response.status);
    }

    const data = (await response.json()) as T;

    // Cache successful GET responses in localStorage for offline resilience
    if (!isMutation && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`missionpath_cache_${endpoint}`, JSON.stringify(data));
        localStorage.setItem('missionpath_cache_timestamp', new Date().toISOString());
      } catch {
        // quota full
      }
    }

    return data;
  } catch (err: any) {
    clearTimeout(id);

    // Fallback to cached data if offline or network connection fails
    if (!isMutation && typeof window !== 'undefined') {
      const cached = localStorage.getItem(`missionpath_cache_${endpoint}`);
      if (cached) {
        try {
          console.warn(`[MissionPath Network Alert] Using cached fallback for ${endpoint}`);
          return JSON.parse(cached) as T;
        } catch {
          // parse failed
        }
      }
    }

    if (err.name === 'AbortError') {
      throw new ApiError(`Request timeout after ${timeoutMs}ms for ${endpoint}`, 408);
    }
    throw err;
  }
}

export const apiService = {
  // 1. GET /health
  getHealth: (): Promise<HealthResponse> => {
    return request<HealthResponse>('/health');
  },

  // 2. GET /api/state
  getLogisticsState: (): Promise<LogisticsState> => {
    return request<LogisticsState>('/api/state');
  },

  // 3. GET /api/vehicles
  getVehicles: (): Promise<Vehicle[]> => {
    return request<Vehicle[]>('/api/vehicles');
  },

  // 4. GET /api/depots
  getDepots: (): Promise<Depot[]> => {
    return request<Depot[]>('/api/depots');
  },

  // 5. GET /api/demand-points
  getDemandPoints: (): Promise<DemandPoint[]> => {
    return request<DemandPoint[]>('/api/demand-points');
  },

  // 6. GET /api/routes
  getRoutes: (): Promise<Route[]> => {
    return request<Route[]>('/api/routes');
  },

  // 7. GET /api/predictions
  getPredictions: (): Promise<PredictionResponse> => {
    return request<PredictionResponse>('/api/predictions');
  },

  // 8. GET /api/shortages
  getShortages: (): Promise<ShortageResponse> => {
    return request<ShortageResponse>('/api/shortages');
  },

  // 9. POST /api/optimize
  postOptimize: (payload: any = {}): Promise<OptimizationResult> => {
    return request<OptimizationResult>('/api/optimize', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 10. POST /api/simulation/disruption
  postDisruption: (payload: DisruptionRequest): Promise<DisruptionResult> => {
    return request<DisruptionResult>('/api/simulation/disruption', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 11. POST /api/reoptimize
  postReoptimize: (payload: ReoptimizeRequest = {}): Promise<ReoptimizationResult> => {
    return request<ReoptimizationResult>('/api/reoptimize', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 12. POST /api/courses-of-action
  postCoursesOfAction: (payload: any = {}): Promise<CoursesOfActionResponse> => {
    return request<CoursesOfActionResponse>('/api/courses-of-action', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 13. GET /api/resilience
  getResilience: (): Promise<ResilienceScore> => {
    return request<ResilienceScore>('/api/resilience');
  },

  // 14. GET /api/vehicle-health
  getVehicleHealth: (vehicleId?: string): Promise<VehicleHealthResponse> => {
    const endpoint = vehicleId
      ? `/api/vehicle-health/${encodeURIComponent(vehicleId)}`
      : '/api/vehicle-health';
    return request<VehicleHealthResponse>(endpoint);
  },

  // 14.5 GET /api/plans
  getPlans: (): Promise<any[]> => {
    return request<any[]>('/api/plans');
  },

  // 14.6 GET /api/plans/{plan_id}
  getPlan: (planId: string): Promise<any> => {
    return request<any>(`/api/plans/${encodeURIComponent(planId)}`);
  },

  // 15. POST /api/plans/{plan_id}/approve
  postApprovePlan: (planId: string, reason?: string): Promise<PlanDecisionResponse> => {
    return request<PlanDecisionResponse>(`/api/plans/${encodeURIComponent(planId)}/approve`, {
      method: 'POST',
      body: JSON.stringify(reason ? { reason } : {}),
    });
  },

  // 16. POST /api/plans/{plan_id}/reject
  postRejectPlan: (planId: string, reason?: string): Promise<PlanDecisionResponse> => {
    return request<PlanDecisionResponse>(`/api/plans/${encodeURIComponent(planId)}/reject`, {
      method: 'POST',
      body: JSON.stringify(reason ? { reason } : {}),
    });
  },

  // 17. POST /api/copilot
  postCopilot: (payload: CopilotRequest): Promise<CopilotResponse> => {
    return request<CopilotResponse>('/api/copilot', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 18. POST /api/demo/run
  postDemoRun: (): Promise<DemoRunResponse> => {
    return request<DemoRunResponse>('/api/demo/run', {
      method: 'POST',
    });
  },
};

export default apiService;

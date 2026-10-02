# SAKSHAM / MissionPath — Complete Backend API Contract

> **Frontend Integration Specification**  
> **Base URL**: `http://localhost:8000` (Local) / Custom Deployment Host  
> **Protocol**: HTTP/1.1 REST + JSON  
> **Authentication**: None for current prototype / Bearer Token configurable via header  
> **Data Types**: Standard ISO 8601 UTC timestamps, strict Pydantic schemas  

---

## Quick Navigation

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 1 | `GET` | [`/health`](#1-get-health) | Service health check and liveness probe |
| 2 | `GET` | [`/api/state`](#2-get-apistate) | Full snapshot of active network state |
| 3 | `GET` | [`/api/vehicles`](#3-get-apivehicles) | Fleet telemetry and vehicle statuses |
| 4 | `GET` | [`/api/depots`](#4-get-apidepots) | Supply depots and inventory stock levels |
| 5 | `GET` | [`/api/demand-points`](#5-get-apidemand-points) | Relief destinations, priorities & required supplies |
| 6 | `GET` | [`/api/routes`](#6-get-apiroutes) | Transit routes with distances, times & risk hazards |
| 7 | `GET` | [`/api/predictions`](#7-get-apipredictions) | Deterministic demand forecasting & depletion estimates |
| 8 | `GET` | [`/api/shortages`](#8-get-apishortages) | Impending shortages ranked by urgency with resupply quantities |
| 9 | `POST` | [`/api/optimize`](#9-post-apioptimize) | Google OR-Tools CP-SAT vehicle dispatch optimization |
| 10 | `POST` | [`/api/simulation/disruption`](#10-post-apisimulationdisruption) | Disruption simulation engine (route, vehicle, surge, shortage) |
| 11 | `POST` | [`/api/reoptimize`](#11-post-apireoptimize) | Dynamic re-optimization after network disruptions |
| 12 | `POST` | [`/api/courses-of-action`](#12-post-apicourses-of-action) | Generates 3 strategic trade-off plans (Fastest, Safe, Efficient) |
| 13 | `GET` | [`/api/resilience`](#13-get-apiresilience) | Multi-dimensional supply chain resilience score (0–100) |
| 14 | `GET` | [`/api/vehicle-health`](#14-get-apivehicle-health) | Fleet telemetry and predictive maintenance risk |
| 15 | `POST` | [`/api/plans/{plan_id}/approve`](#15-post-apiplansplan_idapprove) | Human operator plan approval & world state activation |
| 16 | `POST` | [`/api/plans/{plan_id}/reject`](#16-post-apiplansplan_idreject) | Human operator plan rejection |
| 17 | `POST` | [`/api/copilot`](#17-post-apicopilot) | Grounded AI Logistics Copilot natural language Q&A |

---

## Detailed Endpoint Specifications

---

### 1. `GET /health`
Liveness probe confirming service health.

- **URL**: `/health`
- **Method**: `GET`
- **Request Headers**: None
- **Request Body**: None

#### Response (`200 OK`):
```json
{
  "status": "ok",
  "service": "MissionPath Backend"
}
```

#### Possible Errors:
- `500 Internal Server Error`: Service unhealthy or startup failure.

---

### 2. `GET /api/state`
Returns the complete single source-of-truth logistics network state.

- **URL**: `/api/state`
- **Method**: `GET`
- **Request Body**: None

#### Response (`200 OK`):
```json
{
  "vehicles": {
    "VEH-01": {
      "id": "VEH-01",
      "capacity": 8000.0,
      "current_location": { "lat": 30.3165, "lon": 78.0322 },
      "available": true,
      "fuel_level": 95.0,
      "speed": 55.0
    }
  },
  "depots": {
    "DEPOT-ALPHA": {
      "id": "DEPOT-ALPHA",
      "location": { "lat": 30.3165, "lon": 78.0322 },
      "inventory": {
        "medicine": 6000.0,
        "water": 30000.0,
        "food": 22000.0,
        "fuel": 18000.0,
        "equipment": 5000.0
      }
    }
  },
  "demand_points": {
    "DEMAND-01": {
      "id": "DEMAND-01",
      "location": { "lat": 30.5500, "lon": 78.4000 },
      "required_supplies": {
        "medicine": 1200.0,
        "water": 4000.0
      },
      "priority": "critical",
      "deadline": "2026-10-02T20:00:00Z"
    }
  },
  "routes": {
    "ROUTE-01": {
      "id": "ROUTE-01",
      "source": { "lat": 30.3165, "lon": 78.0322 },
      "destination": { "lat": 30.5500, "lon": 78.4000 },
      "distance": 42.5,
      "travel_time": 0.85,
      "risk": "safe",
      "available": true
    }
  },
  "deliveries": [],
  "timestamp": "2026-10-02T16:00:00Z"
}
```

#### Possible Errors:
- `500 Internal Server Error`: State retrieval failure.

---

### 3. `GET /api/vehicles`
Retrieves all transport fleet vehicles.

- **URL**: `/api/vehicles`
- **Method**: `GET`

#### Response (`200 OK`):
```json
[
  {
    "id": "VEH-01",
    "capacity": 8000.0,
    "current_location": { "lat": 30.3165, "lon": 78.0322 },
    "available": true,
    "fuel_level": 95.0,
    "speed": 55.0
  },
  {
    "id": "VEH-10",
    "capacity": 4000.0,
    "current_location": { "lat": 30.1897, "lon": 78.1804 },
    "available": false,
    "fuel_level": 40.0,
    "speed": 55.0
  }
]
```

---

### 4. `GET /api/depots`
Retrieves all supply bases and inventory stock levels.

- **URL**: `/api/depots`
- **Method**: `GET`

#### Response (`200 OK`):
```json
[
  {
    "id": "DEPOT-ALPHA",
    "location": { "lat": 30.3165, "lon": 78.0322 },
    "inventory": {
      "medicine": 6000.0,
      "water": 30000.0,
      "food": 22000.0,
      "fuel": 18000.0,
      "equipment": 5000.0
    }
  }
]
```

---

### 5. `GET /api/demand-points`
Retrieves all disaster relief / military destination demand points.

- **URL**: `/api/demand-points`
- **Method**: `GET`

#### Response (`200 OK`):
```json
[
  {
    "id": "DEMAND-01",
    "location": { "lat": 30.5500, "lon": 78.4000 },
    "required_supplies": {
      "medicine": 1200.0,
      "water": 4000.0
    },
    "priority": "critical",
    "deadline": "2026-10-02T20:00:00Z"
  }
]
```

---

### 6. `GET /api/routes`
Retrieves all route segments connecting depots and demand points.

- **URL**: `/api/routes`
- **Method**: `GET`

#### Response (`200 OK`):
```json
[
  {
    "id": "ROUTE-01",
    "source": { "lat": 30.3165, "lon": 78.0322 },
    "destination": { "lat": 30.5500, "lon": 78.4000 },
    "distance": 42.5,
    "travel_time": 0.85,
    "risk": "safe",
    "available": true
  },
  {
    "id": "ROUTE-12",
    "source": { "lat": 30.2200, "lon": 78.3100 },
    "destination": { "lat": 30.5500, "lon": 78.4000 },
    "distance": 22.0,
    "travel_time": 0.70,
    "risk": "blocked",
    "available": false
  }
]
```

---

### 7. `GET /api/predictions`
Forecasts future supply requirements and estimated times to stockout.

- **URL**: `/api/predictions?horizon_hours=12.0`
- **Method**: `GET`
- **Query Parameters**:
  - `horizon_hours` (float, optional, default: `12.0`, min: `0.1`, max: `168.0`)

#### Response (`200 OK`):
```json
{
  "generated_at": "2026-10-02T16:00:00Z",
  "horizon_hours": 12.0,
  "demand_points": [
    {
      "demand_point_id": "DEMAND-01",
      "priority": "critical",
      "deadline": "2026-10-02T20:00:00Z",
      "supplies": [
        {
          "supply_type": "medicine",
          "current_requirement": 1200.0,
          "consumption_rate": 50.0,
          "predicted_demand": 1800.0,
          "time_to_shortage_hours": 8.0,
          "severity": "HIGH",
          "confidence_score": 0.92
        }
      ]
    }
  ]
}
```

#### Possible Errors:
- `422 Unprocessable Entity`: `horizon_hours` $\le 0.0$ or $> 168.0$.

---

### 8. `GET /api/shortages`
Detects active and near-future supply deficits, ranked by urgency.

- **URL**: `/api/shortages?horizon_hours=12.0`
- **Method**: `GET`
- **Query Parameters**:
  - `horizon_hours` (float, optional, default: `12.0`)

#### Response (`200 OK`):
```json
{
  "generated_at": "2026-10-02T16:00:00Z",
  "horizon_hours": 12.0,
  "total_shortages_detected": 1,
  "critical_shortages_count": 1,
  "high_shortages_count": 0,
  "shortages": [
    {
      "demand_point_id": "DEMAND-01",
      "supply_type": "medicine",
      "current_available": 400.0,
      "consumption_rate": 100.0,
      "time_to_shortage": 4.0,
      "predicted_shortage": 800.0,
      "severity": "CRITICAL",
      "recommended_resupply_quantity": 1000.0,
      "priority": "critical",
      "deadline": "2026-10-02T20:00:00Z",
      "urgency_score": 95.0
    }
  ]
}
```

---

### 9. `POST /api/optimize`
Runs the Google OR-Tools CP-SAT optimizer to generate a feasible delivery schedule.

- **URL**: `/api/optimize`
- **Method**: `POST`
- **Request Body** (optional):
```json
{
  "weights": {
    "weight_unmet_critical": 10000,
    "weight_unmet_high": 5000,
    "weight_unmet_medium": 2000,
    "weight_unmet_low": 1000,
    "weight_distance": 10,
    "weight_travel_time": 100,
    "weight_late_delivery": 5000
  }
}
```

#### Response (`200 OK`):
```json
{
  "status": "OPTIMAL",
  "objective_value": 4125.0,
  "deliveries": [
    {
      "vehicle_id": "VEH-01",
      "depot_id": "DEPOT-ALPHA",
      "demand_point_id": "DEMAND-01",
      "supply_type": "medicine",
      "quantity": 1200.0,
      "route_id": "ROUTE-01",
      "distance": 42.5,
      "travel_time": 0.85,
      "risk": "safe",
      "eta": 0.85,
      "deadline": "2026-10-02T20:00:00Z",
      "late_delivery": false,
      "priority": "critical"
    }
  ],
  "unmet_demand": {
    "DEMAND-01": {
      "medicine": 0.0,
      "water": 0.0
    }
  },
  "total_supplied": 3500.0,
  "total_unmet_demand": 0.0,
  "inventory_used": {
    "DEPOT-ALPHA": {
      "medicine": 1200.0
    }
  },
  "inventory_remaining": {
    "DEPOT-ALPHA": {
      "medicine": 4800.0
    }
  },
  "total_distance": 98.4,
  "total_eta": 2.65,
  "total_late_deliveries": 0
}
```

#### Possible Errors:
- `500 Internal Server Error`: CP-SAT solver exception.

---

### 10. `POST /api/simulation/disruption`
Injects real-time events (`BLOCK_ROUTE`, `VEHICLE_FAILURE`, `DEMAND_SURGE`, `INVENTORY_SHORTAGE`, `NEW_EMERGENCY`) into the simulation state.

- **URL**: `/api/simulation/disruption`
- **Method**: `POST`
- **Request Body**:
```json
{
  "type": "BLOCK_ROUTE",
  "target_id": "ROUTE-01",
  "parameters": {}
}
```

#### Supported Disruption Types & Parameters:
- `BLOCK_ROUTE`: `target_id`: Route ID (e.g. `"ROUTE-01"`)
- `VEHICLE_FAILURE`: `target_id`: Vehicle ID (e.g. `"VEH-01"`)
- `DEMAND_SURGE`: `target_id`: Demand Point ID, `parameters`: `{"multiplier": 2.0, "supply_type": "medicine"}`
- `INVENTORY_SHORTAGE`: `target_id`: Depot ID, `parameters`: `{"loss_fraction": 0.5}`
- `NEW_EMERGENCY`: `target_id`: New ID, `parameters`: `{"location": {"lat": 30.45, "lon": 78.35}, "required_supplies": {"medicine": 500.0}, "priority": "critical"}`

#### Response (`200 OK`):
```json
{
  "event_id": "DISRUPT-A9B8C7",
  "event_type": "BLOCK_ROUTE",
  "affected_entities": ["ROUTE-01"],
  "state_changes": {
    "route_id": "ROUTE-01",
    "previous_available": true,
    "new_available": false
  },
  "timestamp": "2026-10-02T16:10:00Z"
}
```

#### Possible Errors:
- `400 Bad Request`: Unknown disruption type or missing target entity.
- `422 Unprocessable Entity`: Schema validation failure.

---

### 11. `POST /api/reoptimize`
Detects disruption impact on active deliveries and re-solves the network via CP-SAT.

- **URL**: `/api/reoptimize`
- **Method**: `POST`
- **Request Body**:
```json
{
  "disruption": {
    "type": "BLOCK_ROUTE",
    "target_id": "ROUTE-01"
  }
}
```

#### Response (`200 OK`):
```json
{
  "trigger": "BLOCK_ROUTE: ROUTE-01",
  "affected_deliveries": [
    {
      "vehicle_id": "VEH-01",
      "depot_id": "DEPOT-ALPHA",
      "demand_point_id": "DEMAND-01",
      "supply_type": "medicine",
      "quantity": 1200.0,
      "route_id": "ROUTE-01",
      "distance": 42.5,
      "travel_time": 0.85,
      "risk": "safe",
      "eta": 0.85
    }
  ],
  "affected_vehicles": [],
  "affected_routes": ["ROUTE-01"],
  "previous_eta": 0.85,
  "new_eta": 1.15,
  "delay": 0.30,
  "previous_plan": { "status": "OPTIMAL", "total_supplied": 1200.0, "deliveries": [] },
  "new_plan": { "status": "OPTIMAL", "total_supplied": 1200.0, "deliveries": [] },
  "unmet_demand": {},
  "optimization_status": "OPTIMAL"
}
```

---

### 12. `POST /api/courses-of-action`
Generates 3 distinct feasible trade-off plans using CP-SAT for operator selection.

- **URL**: `/api/courses-of-action`
- **Method**: `POST`
- **Request Body** (optional):
```json
{
  "disruption": {
    "type": "BLOCK_ROUTE",
    "target_id": "ROUTE-01"
  }
}
```

#### Response (`200 OK`):
```json
{
  "plans": [
    {
      "id": "COA-FASTEST-8A1B",
      "name": "FASTEST",
      "eta": 2.85,
      "distance": 115.0,
      "risk": 0.35,
      "cost": 787.5,
      "unmet_demand": 0.0,
      "deliveries": [],
      "status": "OPTIMAL",
      "description": "Maximizes delivery velocity to arrive in minimum transit time."
    },
    {
      "id": "COA-LOWEST_RISK-3C4D",
      "name": "LOWEST_RISK",
      "eta": 3.40,
      "distance": 130.0,
      "risk": 0.10,
      "cost": 840.0,
      "unmet_demand": 0.0,
      "deliveries": [],
      "status": "OPTIMAL",
      "description": "Maximizes convoy security by strictly selecting safer transit corridors."
    },
    {
      "id": "COA-RESOURCE_EFFICIENT-5E6F",
      "name": "RESOURCE_EFFICIENT",
      "eta": 3.10,
      "distance": 92.0,
      "risk": 0.25,
      "cost": 665.0,
      "unmet_demand": 0.0,
      "deliveries": [],
      "status": "OPTIMAL",
      "description": "Minimizes total mileage and fuel consumption to conserve vehicle wear."
    }
  ],
  "generated_at": "2026-10-02T16:15:00Z"
}
```

---

### 13. `GET /api/resilience` (or `/api/resilience/score`)
Calculates the holistic 0–100 Supply Chain Resilience Score across 5 core dimensions.

- **URL**: `/api/resilience`
- **Method**: `GET`

#### Response (`200 OK`):
```json
{
  "overall_score": 78.4,
  "inventory": 90.0,
  "fleet": 85.0,
  "routes": 64.0,
  "demand_coverage": 82.0,
  "connectivity": 88.0,
  "inventory_score": 90.0,
  "fleet_score": 85.0,
  "route_score": 64.0,
  "demand_coverage_score": 82.0,
  "connectivity_score": 88.0,
  "key_factors": [
    "Route availability decreased due to corridor blockages or high risk",
    "Demand coverage improved with active scheduled deliveries",
    "Depot inventories fully stocked across all critical supply types"
  ],
  "calculated_at": "2026-10-02T16:30:00Z"
}
```

---

### 14. `GET /api/vehicle-health`
Returns fleet telemetry and predictive maintenance risk (`LOW`, `MEDIUM`, `HIGH`).

- **URL**: `/api/vehicle-health`
- **Method**: `GET`

#### Response (`200 OK`):
```json
{
  "vehicles": [
    {
      "vehicle_id": "VEH-01",
      "mileage": 4499.0,
      "utilization": 0.0,
      "health_score": 86.0,
      "maintenance_risk": "LOW",
      "available": true,
      "is_operational": true,
      "fuel_level": 95.0,
      "recommended_action": "Vehicle nominal. Ready for high-priority missions."
    },
    {
      "vehicle_id": "VEH-10",
      "mileage": 3079.2,
      "utilization": 0.0,
      "health_score": 15.0,
      "maintenance_risk": "HIGH",
      "available": false,
      "is_operational": false,
      "fuel_level": 40.0,
      "recommended_action": "Critical breakdown / Vehicle offline. Ground vehicle immediately for overhaul."
    }
  ],
  "total_vehicles": 10,
  "operational_count": 9,
  "high_risk_count": 1,
  "average_health_score": 81.3,
  "timestamp": "2026-10-02T16:35:00Z"
}
```

---

### 15. `POST /api/plans/{plan_id}/approve`
Approves an optimization plan, changing its state to `APPROVED` and activating deliveries in the simulation world state.

- **URL**: `/api/plans/{plan_id}/approve`
- **Method**: `POST`
- **Request Body** (optional):
```json
{
  "reason": "Tactical greenlight authorized by Logistics Commander"
}
```

#### Response (`200 OK`):
```json
{
  "plan_id": "PLAN-A1B2C3",
  "status": "APPROVED",
  "message": "Plan 'PLAN-A1B2C3' approved and set as active logistics plan.",
  "is_active": true,
  "plan": {
    "id": "PLAN-A1B2C3",
    "name": "RECOMMENDED_PLAN",
    "status": "APPROVED",
    "total_supplied": 3500.0,
    "total_unmet_demand": 0.0,
    "total_distance": 98.4,
    "total_eta": 2.65,
    "estimated_cost": 384.15,
    "deliveries": []
  },
  "timestamp": "2026-10-02T16:40:00Z"
}
```

#### Possible Errors:
- `400 Bad Request`: Plan is already approved.
- `404 Not Found`: Plan ID does not exist in registry.

---

### 16. `POST /api/plans/{plan_id}/reject`
Rejects an optimization plan and removes deliveries from active execution.

- **URL**: `/api/plans/{plan_id}/reject`
- **Method**: `POST`
- **Request Body** (optional):
```json
{
  "reason": "Corridor security risk unacceptable"
}
```

#### Response (`200 OK`):
```json
{
  "plan_id": "PLAN-A1B2C3",
  "status": "REJECTED",
  "message": "Plan 'PLAN-A1B2C3' rejected by operator.",
  "is_active": false,
  "plan": {
    "id": "PLAN-A1B2C3",
    "name": "RECOMMENDED_PLAN",
    "status": "REJECTED",
    "total_supplied": 3500.0,
    "total_unmet_demand": 0.0,
    "total_distance": 98.4,
    "total_eta": 2.65,
    "estimated_cost": 384.15,
    "deliveries": []
  },
  "timestamp": "2026-10-02T16:40:00Z"
}
```

#### Possible Errors:
- `404 Not Found`: Plan ID does not exist.

---

### 17. `POST /api/copilot`
Submits natural language queries to the AI Logistics Copilot explanation layer.

- **URL**: `/api/copilot`
- **Method**: `POST`
- **Request Body**:
```json
{
  "question": "Why was Route ROUTE-12 not used for delivery?",
  "context": "Northern mountain sector transit"
}
```

#### Response (`200 OK`):
```json
{
  "answer": "Route ROUTE-12 was changed or excluded because it is marked as BLOCKED/UNAVAILABLE (risk level: BLOCKED). The CP-SAT solver strictly enforces availability constraints and automatically rerouted deliveries through safe, navigable alternative corridors.",
  "referenced_entities": [
    "ROUTE-12"
  ],
  "context_summary": "Fleet: 10 vehicles (9 operational). | Depots: 3 supply depots. | Demand Points: 6 destinations. | Routes: 12 total corridors (11 usable).",
  "provider": "deterministic_grounded_engine",
  "timestamp": "2026-10-02T16:45:00Z"
}
```

#### Possible Errors:
- `422 Unprocessable Entity`: Missing or empty `question` string.

---

## Standard Error Response Schema

All error responses from the API return a standard JSON object:

```json
{
  "detail": "Error message describing the failure reason"
}
```

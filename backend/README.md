# MissionPath Backend

> AI Real-Time Logistics Optimization for Military & Disaster — Smart and Resilient Supply Chains

---

## Overview

**MissionPath** is the AI + Optimization Engine powering smart, resilient supply chain coordination for military operations and disaster relief. It provides real-time route optimization, predictive demand forecasting, disruption simulation, and resilience scoring.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Python 3.11+ |
| Framework | FastAPI |
| Validation | Pydantic v2 |
| Optimization | Google OR-Tools |
| Server | Uvicorn (ASGI) |

---

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app entry point
│   ├── models/              # Pydantic data models (supply nodes, routes, missions)
│   ├── optimizer/           # OR-Tools VRP / route optimization engine
│   ├── prediction/          # AI demand & disruption prediction
│   ├── simulation/          # Monte-Carlo / scenario simulation
│   ├── resilience/          # Resilience scoring & alternate path logic
│   └── api/                 # Route handlers (routers)
├── requirements.txt
└── README.md
```

---

## Getting Started

### 1. Create and activate virtual environment

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the development server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## API Endpoints (Complete Catalog)

For the complete, frontend-ready API contract with full JSON payloads, see [`docs/API.md`](../docs/API.md).

| # | Method | Endpoint | Response Model | Description |
|---|--------|----------|----------------|-------------|
| 1 | `GET` | `/health` | `HealthResponse` | Liveness probe & service health check |
| 2 | `GET` | `/api/state` | `LogisticsState` | Complete snapshot of in-memory logistics network |
| 3 | `GET` | `/api/vehicles` | `List[Vehicle]` | Fleet of transport vehicles and current statuses |
| 4 | `GET` | `/api/depots` | `List[Depot]` | Supply depots and available inventory stock |
| 5 | `GET` | `/api/demand-points` | `List[DemandPoint]` | Relief destinations, required supplies, and deadlines |
| 6 | `GET` | `/api/routes` | `List[Route]` | Network edges with distance, travel time, and risk |
| 7 | `GET` | `/api/predictions` | `PredictionResponse` | Demand forecasting and depletion metrics |
| 8 | `GET` | `/api/shortages` | `ShortageResponse` | Impending supply shortages ranked by urgency |
| 9 | `POST` | `/api/optimize` | `OptimizationResult` | CP-SAT optimization of vehicle allocations & deliveries |
| 10 | `POST` | `/api/simulation/disruption` | `DisruptionResult` | Injects disruption events into simulation world state |
| 11 | `POST` | `/api/reoptimize` | `ReoptimizationResult` | Dynamic re-optimization after network disruptions |
| 12 | `POST` | `/api/courses-of-action` | `CoursesOfActionResponse` | Generates 3 distinct feasible trade-off plans |
| 13 | `GET` | `/api/resilience` | `ResilienceScore` | Supply Chain Resilience Score (0–100) across 5 dimensions |
| 14 | `GET` | `/api/vehicle-health` | `VehicleHealthResponse` | Fleet telemetry and predictive maintenance risk |
| 15 | `POST` | `/api/plans/{plan_id}/approve` | `PlanDecisionResponse` | Human approval and state delivery activation |
| 16 | `POST` | `/api/plans/{plan_id}/reject` | `PlanDecisionResponse` | Human operator plan rejection |
| 17 | `POST` | `/api/copilot` | `CopilotResponse` | Grounded AI Logistics Copilot explanation layer |

---

## API Documentation & Example Responses

### 1. `GET /health`
Liveness probe confirming service health.

**Response (`200 OK`):**
```json
{
  "status": "ok",
  "service": "MissionPath Backend"
}
```

---

### 2. `GET /api/state`
Returns the complete single source-of-truth logistics network state snapshot.

**Response (`200 OK`):**
```json
{
  "vehicles": {
    "VEH-01": {
      "id": "VEH-01",
      "capacity": 8000.0,
      "current_location": {
        "lat": 30.3165,
        "lon": 78.0322
      },
      "available": true,
      "fuel_level": 95.0,
      "speed": 55.0
    }
  },
  "depots": {
    "DEPOT-ALPHA": {
      "id": "DEPOT-ALPHA",
      "location": {
        "lat": 30.3165,
        "lon": 78.0322
      },
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
      "location": {
        "lat": 30.55,
        "lon": 78.4
      },
      "required_supplies": {
        "medicine": 1200.0,
        "water": 4000.0,
        "food": 2500.0,
        "fuel": 1500.0,
        "equipment": 600.0
      },
      "priority": "critical",
      "deadline": "2026-10-03T06:00:00Z",
      "consumption_rate": {
        "medicine": 45.0,
        "water": 120.0,
        "food": 80.0,
        "fuel": 30.0,
        "equipment": 10.0
      }
    }
  },
  "routes": {
    "ROUTE-01": {
      "id": "ROUTE-01",
      "source": {
        "lat": 30.3165,
        "lon": 78.0322
      },
      "destination": {
        "lat": 30.39,
        "lon": 78.15
      },
      "distance": 16.5,
      "travel_time": 0.45,
      "risk": "safe",
      "available": true
    }
  },
  "deliveries": []
}
```

---

### 3. `GET /api/vehicles`
Returns the active transport fleet.

**Response (`200 OK`):**
```json
[
  {
    "id": "VEH-01",
    "capacity": 8000.0,
    "current_location": {
      "lat": 30.3165,
      "lon": 78.0322
    },
    "available": true,
    "fuel_level": 95.0,
    "speed": 55.0
  },
  {
    "id": "VEH-10",
    "capacity": 4000.0,
    "current_location": {
      "lat": 30.1897,
      "lon": 78.1804
    },
    "available": false,
    "fuel_level": 40.0,
    "speed": 55.0
  }
]
```

---

### 4. `GET /api/depots`
Returns supply origin bases with inventory levels.

**Response (`200 OK`):**
```json
[
  {
    "id": "DEPOT-ALPHA",
    "location": {
      "lat": 30.3165,
      "lon": 78.0322
    },
    "inventory": {
      "medicine": 6000.0,
      "water": 30000.0,
      "food": 22000.0,
      "fuel": 18000.0,
      "equipment": 5000.0
    }
  },
  {
    "id": "DEPOT-BRAVO",
    "location": {
      "lat": 30.1058,
      "lon": 78.288
    },
    "inventory": {
      "medicine": 4000.0,
      "water": 20000.0,
      "food": 15000.0,
      "fuel": 12000.0,
      "equipment": 7500.0
    }
  }
]
```

---

### 5. `GET /api/demand-points`
Returns supply destination points with requirements, urgency, and deadlines.

**Response (`200 OK`):**
```json
[
  {
    "id": "DEMAND-01",
    "location": {
      "lat": 30.55,
      "lon": 78.4
    },
    "required_supplies": {
      "medicine": 1200.0,
      "water": 4000.0,
      "food": 2500.0,
      "fuel": 1500.0,
      "equipment": 600.0
    },
    "priority": "critical",
    "deadline": "2026-10-03T06:00:00Z",
    "consumption_rate": {
      "medicine": 45.0,
      "water": 120.0,
      "food": 80.0,
      "fuel": 30.0,
      "equipment": 10.0
    }
  }
]
```

---

### 6. `GET /api/routes`
Returns network route segments with length, travel time, and risk classification.

**Response (`200 OK`):**
```json
[
  {
    "id": "ROUTE-01",
    "source": {
      "lat": 30.3165,
      "lon": 78.0322
    },
    "destination": {
      "lat": 30.39,
      "lon": 78.15
    },
    "distance": 16.5,
    "travel_time": 0.45,
    "risk": "safe",
    "available": true
  },
  {
    "id": "ROUTE-12",
    "source": {
      "lat": 30.62,
      "lon": 78.25
    },
    "destination": {
      "lat": 30.55,
      "lon": 78.4
    },
    "distance": 22.0,
    "travel_time": 0.7,
    "risk": "blocked",
    "available": false
  }
]
```

---

### 7. `POST /api/optimize`
Executes Google OR-Tools CP-SAT optimizer to determine optimal vehicle allocations, supply deliveries, and routes based on either a custom `LogisticsState` body (or `OptimizeRequest` with configurable weights) or the default simulated world state.

**Request:**
`POST /api/optimize` (body optional, accepts `LogisticsState` or `{ "state": LogisticsState, "weights": OptimizerWeights }`)

Optional configurable objective weights:
- `weight_unmet_critical`: penalty multiplier for unmet critical demand (default 10,000)
- `weight_unmet_high`: penalty multiplier for unmet high demand (default 5,000)
- `weight_unmet_medium`: penalty multiplier for unmet medium demand (default 2,000)
- `weight_unmet_low`: penalty multiplier for unmet low demand (default 1,000)
- `weight_distance`: penalty per km of travel distance (default 10)
- `weight_travel_time`: penalty per hour of travel time (default 100)
- `weight_risk_safe` / `low` / `medium` / `high`: penalties per route risk tier
- `weight_late_delivery`: penalty for deliveries arriving past demand deadline (default 5,000)

**Response (`200 OK`):**
```json
{
  "status": "OPTIMAL",
  "objective_value": 3524800.0,
  "deliveries": [
    {
      "vehicle_id": "VEH-01",
      "depot_id": "DEPOT-ALPHA",
      "demand_point_id": "DEMAND-01",
      "supply_type": "water",
      "quantity": 4000.0,
      "route_id": "ROUTE-03",
      "distance": 52.0,
      "travel_time": 1.35,
      "risk": "safe",
      "eta": 1.35,
      "deadline": "2026-10-03T06:00:00Z",
      "late_delivery": false,
      "priority": "critical"
    },
    {
      "vehicle_id": "VEH-02",
      "depot_id": "DEPOT-ALPHA",
      "demand_point_id": "DEMAND-06",
      "supply_type": "water",
      "quantity": 3500.0,
      "route_id": "ROUTE-02",
      "distance": 41.0,
      "travel_time": 1.10,
      "risk": "low",
      "eta": 1.10,
      "deadline": "2026-10-03T12:00:00Z",
      "late_delivery": false,
      "priority": "medium"
    }
  ],
  "unmet_demand": {
    "DEMAND-01": {
      "medicine": 0.0,
      "water": 0.0,
      "food": 0.0,
      "fuel": 1500.0,
      "equipment": 600.0
    }
  },
  "total_supplied": 7500.0,
  "total_unmet_demand": 2100.0,
  "inventory_used": {
    "DEPOT-ALPHA": {
      "medicine": 0.0,
      "water": 7500.0,
      "food": 0.0,
      "fuel": 0.0,
      "equipment": 0.0
    }
  },
  "inventory_remaining": {
    "DEPOT-ALPHA": {
      "medicine": 6000.0,
      "water": 22500.0,
      "food": 22000.0,
      "fuel": 18000.0,
      "equipment": 5000.0
    }
  },
  "total_distance": 93.0,
  "total_eta": 2.45,
  "total_late_deliveries": 0
}
```

---

### 8. `GET /api/predictions`
Returns deterministic near-future supply demand forecasts, depletion timelines, and shortage severity classifications for all active demand points.

**Parameters:**
- `horizon_hours` (query, optional, default: `6.0`): Forecast lookahead window in hours.

**Formula:**
$$\text{predicted\_demand} = \text{current\_requirement} + (\text{consumption\_rate} \times \text{horizon\_hours})$$

**Response (`200 OK`):**
```json
{
  "time_horizon_hours": 6.0,
  "generated_at": "2026-10-02T15:30:00Z",
  "total_demand_points": 6,
  "critical_shortage_count": 2,
  "predictions": {
    "DEMAND-01": {
      "demand_point_id": "DEMAND-01",
      "priority": "critical",
      "deadline": "2026-10-03T06:00:00Z",
      "time_horizon_hours": 6.0,
      "highest_severity": "critical",
      "recommended_urgency_score": 113.8,
      "predictions": {
        "water": {
          "supply_type": "water",
          "current_requirement": 4000.0,
          "consumption_rate": 120.0,
          "predicted_demand": 4720.0,
          "estimated_time_to_shortage": 0.0,
          "shortage_severity": "critical",
          "prediction_confidence": 0.95
        },
        "medicine": {
          "supply_type": "medicine",
          "current_requirement": 1200.0,
          "consumption_rate": 45.0,
          "predicted_demand": 1470.0,
          "estimated_time_to_shortage": 0.0,
          "shortage_severity": "critical",
          "prediction_confidence": 0.95
        }
      }
    }
  },
  "total_predicted_demand": {
    "medicine": 6880.0,
    "water": 24980.0,
    "food": 16980.0,
    "fuel": 10560.0,
    "equipment": 4320.0
  }
}
```

---

### 9. `GET /api/shortages`
Detects active and impending supply stockouts across all demand locations, calculates exact times to exhaustion, determines recommended resupply quantities, and ranks results strictly by urgency.

**Parameters:**
- `horizon_hours` (query, optional, default: `12.0`): Evaluation planning horizon in hours.

**Response (`200 OK`):**
```json
{
  "generated_at": "2026-10-02T15:30:00Z",
  "horizon_hours": 12.0,
  "total_shortages_detected": 6,
  "critical_shortages_count": 2,
  "high_shortages_count": 2,
  "shortages": [
    {
      "demand_point_id": "DEMAND-01",
      "supply_type": "water",
      "current_available": 0.0,
      "consumption_rate": 120.0,
      "time_to_shortage": 0.0,
      "predicted_shortage": 5440.0,
      "severity": "critical",
      "recommended_resupply_quantity": 5440.0,
      "priority": "critical",
      "deadline": "2026-10-03T06:00:00Z",
      "urgency_score": 4954.4
    },
    {
      "demand_point_id": "DEMAND-03",
      "supply_type": "medicine",
      "current_available": 400.0,
      "consumption_rate": 100.0,
      "time_to_shortage": 4.0,
      "predicted_shortage": 800.0,
      "severity": "high",
      "recommended_resupply_quantity": 800.0,
      "priority": "high",
      "deadline": null,
      "urgency_score": 3728.0
    }
  ]
}
```

---

### 10. `POST /api/simulation/disruption`
Injects real-time operational disruptions into the simulation environment, mutating the active state while isolating the baseline deterministic dataset.

**Supported Disruption Types:**
- `BLOCK_ROUTE`: Sets target route unavailable and risk to `BLOCKED`.
- `VEHICLE_FAILURE`: Sets target vehicle unavailable.
- `DEMAND_SURGE`: Increases required supplies at a demand point by multiplier or fixed quantity.
- `INVENTORY_SHORTAGE`: Reduces depot inventory stock by percentage or fixed quantity.
- `NEW_EMERGENCY`: Instantiates a new high-priority demand location and establishes transit corridors.

**Example Request:**
```json
{
  "type": "BLOCK_ROUTE",
  "target_id": "ROUTE-04"
}
```

**Response (`200 OK`):**
```json
{
  "event_id": "DISRUPT-9A4B8C1D",
  "event_type": "BLOCK_ROUTE",
  "affected_entities": [
    "ROUTE-04"
  ],
  "state_changes": {
    "route_id": "ROUTE-04",
    "previous_available": true,
    "new_available": false,
    "previous_risk": "low",
    "new_risk": "blocked"
  },
  "timestamp": "2026-10-02T15:45:00Z"
}
```

---

### 11. `POST /api/reoptimize`
Performs dynamic, closed-loop re-optimization upon detecting an operational disruption. Identifies compromised deliveries, updates constraints, recalculates a feasible plan with Google OR-Tools CP-SAT, and returns comparative schedule delay metrics.

**Example Request:**
```json
{
  "disruption": {
    "type": "BLOCK_ROUTE",
    "target_id": "ROUTE-03"
  }
}
```

**Response (`200 OK`):**
```json
{
  "trigger": "BLOCK_ROUTE:ROUTE-03",
  "disruption_event": {
    "event_id": "DISRUPT-1A2B3C4D",
    "event_type": "BLOCK_ROUTE",
    "affected_entities": ["ROUTE-03"],
    "state_changes": {
      "route_id": "ROUTE-03",
      "previous_available": true,
      "new_available": false,
      "previous_risk": "safe",
      "new_risk": "blocked"
    },
    "timestamp": "2026-10-02T16:00:00Z"
  },
  "affected_deliveries": [
    {
      "vehicle_id": "VEH-01",
      "depot_id": "DEPOT-ALPHA",
      "demand_point_id": "DEMAND-01",
      "supply_type": "water",
      "quantity": 4000.0,
      "route_id": "ROUTE-03",
      "distance": 52.0,
      "travel_time": 1.35,
      "risk": "safe",
      "eta": 1.35,
      "deadline": "2026-10-03T06:00:00Z",
      "late_delivery": false,
      "priority": "critical"
    }
  ],
  "affected_vehicles": [],
  "affected_routes": ["ROUTE-03"],
  "previous_eta": 2.45,
  "new_eta": 3.10,
  "delay": 0.65,
  "previous_plan": {
    "status": "OPTIMAL",
    "objective_value": 3524800.0,
    "deliveries": [],
    "total_supplied": 7500.0,
    "total_unmet_demand": 2100.0
  },
  "new_plan": {
    "status": "OPTIMAL",
    "objective_value": 3840200.0,
    "deliveries": [],
    "total_supplied": 7500.0,
    "total_unmet_demand": 2100.0
  },
  "unmet_demand": {
    "DEMAND-01": {
      "medicine": 0.0,
      "water": 0.0,
      "food": 0.0,
      "fuel": 1500.0,
      "equipment": 600.0
    }
  },
  "optimization_status": "OPTIMAL"
}
```

---

### 12. `POST /api/courses-of-action`
Generates three distinct, feasible Courses of Action (`FASTEST`, `LOWEST_RISK`, `RESOURCE_EFFICIENT`) adhering to all hard capacity, inventory, deadline, and route availability constraints for human decision-maker selection.

**Example Request:**
```json
{
  "disruption": {
    "type": "BLOCK_ROUTE",
    "target_id": "ROUTE-03"
  }
}
```

**Response (`200 OK`):**
```json
{
  "plans": [
    {
      "id": "COA-FASTEST-8A1B2C",
      "name": "FASTEST",
      "eta": 2.85,
      "distance": 115.0,
      "risk": 0.35,
      "cost": 787.5,
      "unmet_demand": 0.0,
      "deliveries": [],
      "status": "OPTIMAL",
      "description": "Maximizes delivery velocity to arrive in minimum transit time, accepting longer mileage and moderate route hazards."
    },
    {
      "id": "COA-LOWEST_RISK-3D4E5F",
      "name": "LOWEST_RISK",
      "eta": 3.40,
      "distance": 130.0,
      "risk": 0.10,
      "cost": 840.0,
      "unmet_demand": 0.0,
      "deliveries": [],
      "status": "OPTIMAL",
      "description": "Maximizes convoy security by strictly selecting safer transit corridors, accepting potential travel delays or extra mileage."
    },
    {
      "id": "COA-RESOURCE_EFFICIENT-6G7H8I",
      "name": "RESOURCE_EFFICIENT",
      "eta": 3.10,
      "distance": 92.0,
      "risk": 0.25,
      "cost": 665.0,
      "unmet_demand": 0.0,
      "deliveries": [],
      "status": "OPTIMAL",
      "description": "Minimizes total mileage and fuel consumption to conserve vehicle wear and logistics resources."
    }
  ],
  "generated_at": "2026-10-02T16:15:00Z"
}
```

---

### 11. `GET /api/resilience` (or `/api/resilience/score`)
Calculates the multi-dimensional **Supply Chain Resilience Score (0–100)** from the active logistics state across 5 core dimensions:
1. **Inventory Availability** (depot stock buffer vs regional demand)
2. **Fleet Availability** (operational readiness and vehicle fuel health)
3. **Route Availability** (navigable road network and hazard profile)
4. **Demand Coverage** (fulfilled & scheduled delivery commitments)
5. **Connectivity** (topological graph reachability & corridor redundancy)

**Response (`200 OK`):**
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

### 12. `GET /api/vehicle-health`
Returns simulated telemetry (mileage, utilization, health_score) and predictive maintenance risk (`LOW`, `MEDIUM`, `HIGH`) across the vehicle fleet.

**Response (`200 OK`):**
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

### 13. `POST /api/plans/{plan_id}/approve` & `POST /api/plans/{plan_id}/reject`
Enforces **Human-in-the-Loop decision governance**:
- The optimizer recommends plans with status `PENDING` without executing them automatically.
- Approving a plan marks its status as `APPROVED`, activates its deliveries in the simulation world state, and designates it as the active plan.
- Rejecting a plan marks its status as `REJECTED` and prevents/deactivates delivery execution.

**Approve Request:**
```http
POST /api/plans/PLAN-A1B2C3/approve
Content-Type: application/json

{
  "reason": "Tactical greenlight authorized by Logistics Commander"
}
```

**Approve Response (`200 OK`):**
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

---

### 14. `POST /api/copilot`
Natural language explanation layer providing **grounded, hallucination-free explanations** based solely on CP-SAT solver results, simulation state, resilience indices, and vehicle telemetry.

**Request:**
```http
POST /api/copilot
Content-Type: application/json

{
  "question": "Why was Route ROUTE-12 changed and not used?",
  "context": "Northern mountain sector transit"
}
```

**Response (`200 OK`):**
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

---

## Running Tests

```bash
pytest -v
```

---

*Built for hackathon. Evolving fast.*






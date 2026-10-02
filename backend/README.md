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

## API Endpoints (Current)

| Method | Endpoint | Response Model | Description |
|--------|----------|----------------|-------------|
| GET | `/health` | `HealthResponse` | Liveness probe & service health check |
| GET | `/api/state` | `LogisticsState` | Complete snapshot of in-memory logistics network |
| GET | `/api/vehicles` | `List[Vehicle]` | Fleet of transport vehicles and current statuses |
| GET | `/api/depots` | `List[Depot]` | Supply depots and available inventory stock |
| GET | `/api/demand-points` | `List[DemandPoint]` | Relief destinations, required supplies, and deadlines |
| GET | `/api/routes` | `List[Route]` | Network edges with distance, travel time, and risk |
| POST | `/api/optimize` | `OptimizationResult` | CP-SAT optimization of vehicle allocations & deliveries |

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
Executes Google OR-Tools CP-SAT optimizer to determine optimal vehicle allocations, supply deliveries, and routes based on either a custom `LogisticsState` body or the default simulated world state.

**Request:**
`POST /api/optimize` (body optional, accepts `LogisticsState` JSON)

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
      "eta": 1.35
    },
    {
      "vehicle_id": "VEH-02",
      "depot_id": "DEPOT-ALPHA",
      "demand_point_id": "DEMAND-06",
      "supply_type": "water",
      "quantity": 3500.0,
      "route_id": "ROUTE-02",
      "distance": 41.0,
      "eta": 1.10
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
  "total_eta": 2.45
}
```

---

## Planned Endpoints (Upcoming Sprints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/predict/demand` | AI demand forecasting |
| POST | `/simulate/disruption` | Scenario disruption simulation |
| GET | `/resilience/score` | Supply chain resilience score |
| POST | `/missions` | Create a logistics mission |

---

## Running Tests

```bash
pytest -v
```

---

*Built for hackathon. Evolving fast.*



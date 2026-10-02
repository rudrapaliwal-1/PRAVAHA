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

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |

---

## Planned Endpoints (Upcoming Sprints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/optimize/route` | VRP-based route optimization |
| POST | `/predict/demand` | AI demand forecasting |
| POST | `/simulate/disruption` | Scenario disruption simulation |
| GET | `/resilience/score` | Supply chain resilience score |
| POST | `/missions` | Create a logistics mission |

---

## Health Check

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "MissionPath Backend"
}
```

---

*Built for hackathon. Evolving fast.*

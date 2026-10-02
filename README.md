# SAKSHAM - Disaster Relief Resource-Demand Matching & Logistics Platform

SAKSHAM is a Disaster Relief Resource-Demand Matching & Logistics Coordination Platform built for real-time operations, connecting civilians, emergency responders, and relief agencies.

## Repository Architecture

```
SAKSHAM/
│
├── apps/
│   ├── web/           # React + TypeScript + Vite operations & landing dashboard
│   └── mobile/        # React Native mobile placeholder
│
├── services/
│   ├── api/           # Backend API placeholder
│   ├── optimizer/     # Optimization service placeholder
│   └── ml/            # Machine Learning predictions placeholder
│
├── packages/
│   └── contracts/     # Shared types/contracts placeholder
│
├── docs/              # Documentation files
│
├── infrastructure/    # Deployment and Docker files
│
├── scripts/           # Automation scripts
└── docker-compose.yml
```

## Documentation & API Contract

- **Full Frontend API Contract**: [`docs/API.md`](docs/API.md) — Comprehensive specification covering all 17 backend endpoints, request/response schemas, error codes, and examples.
- **Backend Architecture & Solver Details**: [`backend/README.md`](backend/README.md) — Google OR-Tools CP-SAT logistics optimization, simulation world, dynamic re-optimization, resilience scoring, and copilot.

## Running the Services

### 1. Backend (FastAPI + Google OR-Tools)
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate       # On Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
API Documentation will be available at: `http://localhost:8000/docs`

### 2. Frontend Operations Dashboard (React + Vite)
```bash
cd apps/web
npm install
npm run dev
```
Web dashboard will be available at: `http://localhost:5173`

---

## Running Tests

To run the complete backend test suite (139 tests):
```bash
cd backend
pytest -v
```

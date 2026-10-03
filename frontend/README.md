# MissionPath — Command Center Dashboard Frontend

> **Person 2 Deliverable: Frontend & Operations Command Center Foundation Shell**  
> Disaster Relief Resource-Demand Matching & Logistics Optimization Platform  
> Paired with Person 1 Verified FastAPI Backend.

---

## 🛰 Overview

**MissionPath Frontend** provides the real-time operational interface and situational awareness dashboard for disaster logistics commanders, emergency responders, and relief agencies.

This initial foundation block delivers the complete command center application shell, responsive navigation, top telemetry status bar, and structured views for all 9 core operational modules without connecting live APIs, external chart bundles, or modifying the backend.

---

## 🛠 Tech Stack

- **React 18**: Component-based UI runtime
- **TypeScript**: Strict type definitions aligned with `docs/API.md`
- **Vite**: Ultra-fast module bundler & dev server
- **Tailwind CSS**: Custom military/tactical command center dark theme
- **Lucide React**: Crisp vector iconography

---

## 📁 Directory Structure

```
frontend/
├── src/
│   ├── components/            # Reusable Command Center UI primitives
│   │   ├── MetricCard.tsx     # HUD telemetry KPI card with corner brackets
│   │   ├── Sidebar.tsx        # Responsive navigation sidebar with 9 views
│   │   ├── StatusBadge.tsx    # Tactical glowing status pill badges
│   │   └── TopBar.tsx         # Military status bar (UTC clock, DEFCON, audio)
│   ├── pages/                 # Viewports for all 9 Command Center modules
│   │   ├── DashboardPage.tsx  # High-level operational overview & pipeline
│   │   ├── LiveMapPage.tsx    # GIS spatial map container & layer controls
│   │   ├── FleetPage.tsx      # Vehicle fleet status & telemetry matrix
│   │   ├── InventoryPage.tsx  # Depot stockpiles & supply reserves
│   │   ├── DemandPage.tsx     # Relief demand points & triage priority queue
│   │   ├── OptimizationPage.tsx # CP-SAT route solver & trade-off modes
│   │   ├── DisruptionsPage.tsx# Threat simulation & dynamic re-optimization
│   │   ├── ResiliencePage.tsx # Supply chain resilience & SPOF scoring
│   │   └── AICopilotPage.tsx  # Grounded logistics intelligence terminal
│   ├── services/
│   │   └── api.ts             # Typed endpoint contract mapping (17 endpoints)
│   ├── hooks/
│   │   ├── useClock.ts        # Live synchronized UTC and Local military clock
│   │   └── useCommandCenter.ts# Application state, tabs, and layout toggles
│   ├── types/
│   │   └── index.ts           # Strict TypeScript models matching backend API
│   ├── App.tsx                # Main application layout shell
│   ├── index.css              # Custom grid patterns, radar effects, scrollbars
│   └── main.tsx               # Application bootstrap
├── index.html                 # Tactical document entry & typography links
├── package.json               # Dependencies and build scripts
├── postcss.config.js          # PostCSS processor config
├── tailwind.config.js         # Command Center dark palette & animations
├── tsconfig.json              # TypeScript solution configuration
├── tsconfig.app.json          # App compiler configuration
├── tsconfig.node.json         # Vite config TypeScript setup
├── vite.config.ts             # Vite configuration
└── README.md                  # Frontend documentation
```

---

## 🧭 Navigation Modules (Sidebar Items)

| Module | Identifier | Description |
|--------|------------|-------------|
| **Dashboard** | `dashboard` | High-level mission pipeline, telemetry KPIs, system readiness |
| **Live Map** | `live-map` | GIS spatial projection shell, convoy tracking & layer toggles |
| **Fleet** | `fleet` | 28 registered vehicles, fuel levels, speed, load, status |
| **Inventory** | `inventory` | 5 base depots (Alpha, Beta, Gamma) and stock gauges |
| **Demand** | `demand` | 18 disaster relief sites, triage priorities (P1-P3), urgency |
| **Optimization**| `optimization`| Google OR-Tools CP-SAT multi-vehicle solver & COA trade-offs |
| **Disruptions** | `disruptions` | Landslide, flash flood, breakdown simulation & bypass rerouting |
| **Resilience** | `resilience` | Resilience score (0-100), redundancy vectors, SPOF warnings |
| **AI Copilot** | `ai-copilot` | Natural language grounded assistant interface with suggested prompts |

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
The command center dashboard will launch at: `http://localhost:5173`

### 3. Build for Production
```bash
npm run build
```
Generates optimized static assets in `dist/`.

---

## 🔒 Verification & Constraints Checklist

- [x] **No backend modifications**: Backend files untouched.
- [x] **No API calls connected**: Service stubs and contracts ready for Block 2.
- [x] **No heavy map bundles**: Map shell ready with coordinate HUD & layer controls.
- [x] **No heavy chart libraries**: Clean metric cards & data tables.
- [x] **Professional Dark Command Center Design**: High-contrast, tactical slate/zinc, glowing cyan/emerald/amber accents, military monospace font accents.
- [x] **Responsive Layout**: Desktop collapse, mobile drawer, sticky top status bar.

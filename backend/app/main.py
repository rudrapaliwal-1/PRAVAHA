"""
MissionPath Backend — FastAPI Application Entry Point

AI Real-Time Logistics Optimization for Military & Disaster
Smart and Resilient Supply Chains
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

app = FastAPI(
    title="MissionPath Backend",
    description=(
        "AI Real-Time Logistics Optimization for Military & Disaster — "
        "Smart and Resilient Supply Chains"
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS (allow all origins during development — tighten before production)
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["Health"])
async def health() -> dict:
    """
    Liveness probe — confirms the MissionPath backend is running.

    Returns:
        JSON with status and service name.
    """
    return {
        "status": "ok",
        "service": "MissionPath Backend",
    }


# ---------------------------------------------------------------------------
# API Routers
# ---------------------------------------------------------------------------

from app.api import api_router  # noqa: E402

app.include_router(api_router)


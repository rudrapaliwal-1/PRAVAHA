"""
MissionPath Backend — FastAPI Application Entry Point

AI Real-Time Logistics Optimization for Military & Disaster
Smart and Resilient Supply Chains
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.schemas import ErrorResponse, HealthResponse

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
# Global Exception Handlers
# ---------------------------------------------------------------------------

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Standardizes all HTTP exceptions into the ErrorResponse schema."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catches unhandled server exceptions and returns standard JSON error."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": f"Internal server error: {str(exc)}"},
    )


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Health Check",
    description="Liveness probe — confirms the MissionPath backend is running.",
    responses={
        status.HTTP_200_OK: {
            "model": HealthResponse,
            "description": "Service is healthy and operational.",
        },
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            "model": ErrorResponse,
            "description": "Internal server health error.",
        },
    },
)
async def health() -> HealthResponse:
    """
    Liveness probe — confirms the MissionPath backend is running.

    Returns:
        HealthResponse: status and service name.
    """
    return HealthResponse(
        status="ok",
        service="MissionPath Backend",
    )


# ---------------------------------------------------------------------------
# API Routers
# ---------------------------------------------------------------------------

from app.api import api_router  # noqa: E402

app.include_router(api_router)



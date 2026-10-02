"""
api/routes.py — API route definitions for MissionPath Logistics State.

Endpoints:
- GET /api/state
- GET /api/vehicles
- GET /api/depots
- GET /api/demand-points
- GET /api/routes
"""

from typing import List, Optional

from fastapi import APIRouter, Body, HTTPException, Query, status

from app.api.schemas import ErrorResponse
from app.models.demand_point import DemandPoint
from app.models.depot import Depot
from app.models.logistics_state import LogisticsState
from app.models.optimization import OptimizationResult
from app.models.prediction import PredictionResponse
from app.models.route import Route
from app.models.vehicle import Vehicle
from app.optimizer.service import optimizer_service
from app.prediction.service import prediction_service
from app.simulation.world import world_state_service

router = APIRouter(
    prefix="/api",
    tags=["Logistics State"],
    responses={
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            "model": ErrorResponse,
            "description": "Internal server error occurred while retrieving logistics data.",
        }
    },
)


@router.get(
    "/state",
    response_model=LogisticsState,
    summary="Get Logistics State",
    description="Returns the complete current in-memory LogisticsState snapshot.",
    responses={
        status.HTTP_200_OK: {
            "model": LogisticsState,
            "description": "Full logistics state retrieved successfully.",
        },
    },
)
def get_logistics_state() -> LogisticsState:
    """
    Retrieve the single source-of-truth logistics state snapshot.

    Returns:
        LogisticsState: Full network state including vehicles, depots, demand points, routes, and deliveries.
    """
    try:
        return world_state_service.get_state()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve logistics state: {str(exc)}",
        ) from exc


@router.get(
    "/vehicles",
    response_model=List[Vehicle],
    summary="Get Vehicles",
    description="Returns the fleet of vehicles from the logistics state.",
    responses={
        status.HTTP_200_OK: {
            "model": List[Vehicle],
            "description": "List of active logistics vehicles.",
        },
    },
)
def get_vehicles() -> List[Vehicle]:
    """
    Retrieve all vehicles in the current logistics fleet.

    Returns:
        List[Vehicle]: All registered transport vehicles.
    """
    try:
        return list(world_state_service.get_state().vehicles.values())
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve vehicles: {str(exc)}",
        ) from exc


@router.get(
    "/depots",
    response_model=List[Depot],
    summary="Get Depots",
    description="Returns all supply depots from the logistics state.",
    responses={
        status.HTTP_200_OK: {
            "model": List[Depot],
            "description": "List of supply depots and inventories.",
        },
    },
)
def get_depots() -> List[Depot]:
    """
    Retrieve all supply depots in the logistics network.

    Returns:
        List[Depot]: All supply depots with current inventory levels.
    """
    try:
        return list(world_state_service.get_state().depots.values())
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve depots: {str(exc)}",
        ) from exc


@router.get(
    "/demand-points",
    response_model=List[DemandPoint],
    summary="Get Demand Points",
    description="Returns all demand points from the logistics state.",
    responses={
        status.HTTP_200_OK: {
            "model": List[DemandPoint],
            "description": "List of demand points with required supplies and priorities.",
        },
    },
)
def get_demand_points() -> List[DemandPoint]:
    """
    Retrieve all demand destinations requiring relief/logistics support.

    Returns:
        List[DemandPoint]: All demand points with required supplies, priority, and deadlines.
    """
    try:
        return list(world_state_service.get_state().demand_points.values())
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve demand points: {str(exc)}",
        ) from exc


@router.get(
    "/routes",
    response_model=List[Route],
    summary="Get Routes",
    description="Returns all routes connecting the network nodes.",
    responses={
        status.HTTP_200_OK: {
            "model": List[Route],
            "description": "List of network routes with distance, travel time, and risk metrics.",
        },
    },
)
def get_routes() -> List[Route]:
    """
    Retrieve all network routes between supply nodes and demand destinations.

    Returns:
        List[Route]: All routes with distance, travel time, risk level, and availability.
    """
    try:
        return list(world_state_service.get_state().routes.values())
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve routes: {str(exc)}",
        ) from exc


@router.post(
    "/optimize",
    response_model=OptimizationResult,
    tags=["Logistics Optimization"],
    summary="Optimize Logistics Dispatch",
    description=(
        "Executes Google OR-Tools CP-SAT optimizer to determine optimal vehicle allocations, "
        "routes, and supply delivery quantities based on the provided or current LogisticsState "
        "and optional configurable objective weights."
    ),
    responses={
        status.HTTP_200_OK: {
            "model": OptimizationResult,
            "description": "Optimization solved successfully.",
        },
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            "model": ErrorResponse,
            "description": "Internal server error occurred during optimization.",
        },
    },
)
def optimize(payload: Optional[dict] = Body(default=None)) -> OptimizationResult:
    """
    Execute CP-SAT logistics optimization.

    Args:
        payload: Optional custom LogisticsState dictionary or payload containing 'state' and 'weights'.
                 If omitted, uses current in-memory simulation state with default weights.

    Returns:
        OptimizationResult: Computed delivery plan, unmet demands, and network metrics.
    """
    try:
        from app.models.optimization import OptimizerWeights

        if payload is None:
            target_state = world_state_service.get_state()
            target_weights = None
        elif "vehicles" in payload or "depots" in payload:
            # Direct LogisticsState payload
            target_state = LogisticsState.model_validate(payload)
            target_weights = None
        else:
            state_data = payload.get("state")
            target_state = (
                LogisticsState.model_validate(state_data)
                if state_data is not None
                else world_state_service.get_state()
            )
            weights_data = payload.get("weights")
            target_weights = (
                OptimizerWeights.model_validate(weights_data)
                if weights_data is not None
                else None
            )

        return optimizer_service.optimize(target_state, weights=target_weights)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute logistics optimization: {str(exc)}",
        ) from exc


@router.get(
    "/predictions",
    response_model=PredictionResponse,
    summary="Get Demand Predictions",
    description="Returns deterministic near-future supply demand forecasts and shortage metrics.",
    responses={
        status.HTTP_200_OK: {
            "model": PredictionResponse,
            "description": "Demand predictions calculated successfully.",
        },
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            "model": ErrorResponse,
            "description": "Internal server error occurred during demand prediction.",
        },
    },
)
def get_predictions(
    horizon_hours: float = Query(
        default=6.0,
        gt=0.0,
        le=168.0,
        description="Forecast lookahead horizon in hours (e.g. 6.0, 12.0, 24.0)",
    ),
) -> PredictionResponse:
    """
    Generate near-future demand and depletion predictions for all demand points.

    Args:
        horizon_hours: Lookahead window in hours (default 6.0).

    Returns:
        PredictionResponse: Forecasted requirements, time to shortage, severity, and urgency metrics.
    """
    try:
        current_state = world_state_service.get_state()
        return prediction_service.predict(current_state, horizon_hours=horizon_hours)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute demand predictions: {str(exc)}",
        ) from exc





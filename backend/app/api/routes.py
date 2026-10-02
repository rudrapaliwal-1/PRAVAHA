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
from app.models.coa import CoursesOfActionRequest, CoursesOfActionResponse
from app.models.demand_point import DemandPoint
from app.models.depot import Depot
from app.models.disruption import DisruptionRequest, DisruptionResult
from app.models.logistics_state import LogisticsState
from app.models.optimization import OptimizationResult
from app.models.prediction import PredictionResponse
from app.models.reoptimization import ReoptimizationResult, ReoptimizeRequest
from app.models.resilience import ResilienceScore
from app.models.route import Route
from app.models.shortage import ShortageResponse
from app.models.vehicle import Vehicle
from app.optimizer.coa_service import coa_service
from app.optimizer.reoptimizer import reoptimizer_service
from app.optimizer.service import optimizer_service
from app.prediction.service import prediction_service
from app.prediction.shortage_service import shortage_service
from app.resilience.service import resilience_engine
from app.simulation.disruption_service import disruption_engine
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


@router.get(
    "/shortages",
    response_model=ShortageResponse,
    summary="Get Supply Shortages",
    description="Identifies impending and active supply shortages across all demand points, sorted by urgency.",
    responses={
        status.HTTP_200_OK: {
            "model": ShortageResponse,
            "description": "Supply shortages retrieved and ranked by urgency.",
        },
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            "model": ErrorResponse,
            "description": "Internal server error occurred during shortage detection.",
        },
    },
)
def get_shortages(
    horizon_hours: float = Query(
        default=12.0,
        gt=0.0,
        le=168.0,
        description="Evaluation lookahead horizon in hours (default: 12.0)",
    ),
) -> ShortageResponse:
    """
    Detect active and future supply shortages across all demand locations.

    Args:
        horizon_hours: Planning window in hours.

    Returns:
        ShortageResponse: Collection of shortages sorted by urgency and including recommended resupply amounts.
    """
    try:
        current_state = world_state_service.get_state()
        return shortage_service.detect_shortages(current_state, horizon_hours=horizon_hours)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to detect supply shortages: {str(exc)}",
        ) from exc


@router.post(
    "/simulation/disruption",
    response_model=DisruptionResult,
    summary="Simulate Disruption Event",
    description="Injects an operational disruption into the simulation state and records entity mutations.",
    responses={
        status.HTTP_200_OK: {
            "model": DisruptionResult,
            "description": "Disruption event successfully applied.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Invalid disruption parameters or missing target entity.",
        },
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            "model": ErrorResponse,
            "description": "Internal server error during disruption simulation.",
        },
    },
)
def post_disruption(request: DisruptionRequest = Body(...)) -> DisruptionResult:
    """
    Apply a simulated disruption event (BLOCK_ROUTE, VEHICLE_FAILURE, DEMAND_SURGE,
    INVENTORY_SHORTAGE, NEW_EMERGENCY) to the active world state.

    Args:
        request: Disruption specification containing type, target_id, and parameters.

    Returns:
        DisruptionResult: Details of the mutated entities and before/after properties.
    """
    try:
        current_state = world_state_service.get_state()
        return disruption_engine.apply_disruption(current_state, request)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        ) from val_err
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to simulate disruption: {str(exc)}",
        ) from exc


@router.post(
    "/reoptimize",
    response_model=ReoptimizationResult,
    summary="Dynamic Re-Optimization",
    description="Applies an operational disruption, recalculates the delivery plan via CP-SAT, and returns comparative delta metrics.",
    responses={
        status.HTTP_200_OK: {
            "model": ReoptimizationResult,
            "description": "Logistics plan successfully re-optimized.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Invalid disruption or state specification.",
        },
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            "model": ErrorResponse,
            "description": "Internal server error during re-optimization.",
        },
    },
)
def post_reoptimize(request: ReoptimizeRequest = Body(...)) -> ReoptimizationResult:
    """
    Execute dynamic re-optimization after an operational disruption.

    Workflow:
    1. Retrieve pre-disruption state & baseline plan.
    2. Apply disruption event.
    3. Identify compromised deliveries, routes, and vehicles.
    4. Solve new optimal logistics plan with CP-SAT.
    5. Compare previous plan vs new plan (ETA variance, delay, affected deliveries).

    Args:
        request: ReoptimizeRequest specifying disruption, optional state, previous plan, and weights.

    Returns:
        ReoptimizationResult: Comprehensive comparative re-optimization result.
    """
    try:
        target_state = (
            request.state
            if request.state is not None
            else world_state_service.get_state()
        )
        return reoptimizer_service.reoptimize(
            disruption=request.disruption,
            state=target_state,
            previous_plan=request.previous_plan,
            weights=request.weights,
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        ) from val_err
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute re-optimization: {str(exc)}",
        ) from exc


@router.post(
    "/courses-of-action",
    response_model=CoursesOfActionResponse,
    summary="Generate Courses of Action",
    description="Generates three distinct feasible logistics plans (FASTEST, LOWEST_RISK, RESOURCE_EFFICIENT) for human decision-maker selection.",
    responses={
        status.HTTP_200_OK: {
            "model": CoursesOfActionResponse,
            "description": "Three feasible Courses of Action generated successfully.",
        },
        status.HTTP_400_BAD_REQUEST: {
            "model": ErrorResponse,
            "description": "Invalid disruption or state specification.",
        },
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            "model": ErrorResponse,
            "description": "Internal server error during COA generation.",
        },
    },
)
def post_courses_of_action(
    request: Optional[CoursesOfActionRequest] = Body(default=None),
) -> CoursesOfActionResponse:
    """
    Generate 3 feasible Courses of Action (FASTEST, LOWEST_RISK, RESOURCE_EFFICIENT).

    Args:
        request: Optional request containing state snapshot and/or disruption event.

    Returns:
        CoursesOfActionResponse: The 3 generated optimization plans with executive trade-off summaries.
    """
    try:
        req_state = request.state if request is not None else None
        req_disruption = request.disruption if request is not None else None

        return coa_service.generate_courses_of_action(
            state=req_state,
            disruption=req_disruption,
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        ) from val_err
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate Courses of Action: {str(exc)}",
        ) from exc


@router.get(
    "/resilience",
    response_model=ResilienceScore,
    summary="Get Supply Chain Resilience Score",
    description="Calculates a holistic multi-dimensional 0-100 resilience score from the active state.",
    responses={
        status.HTTP_200_OK: {
            "model": ResilienceScore,
            "description": "Resilience health score computed successfully.",
        },
        status.HTTP_500_INTERNAL_SERVER_ERROR: {
            "model": ErrorResponse,
            "description": "Internal server error during resilience calculation.",
        },
    },
)
@router.get(
    "/resilience/score",
    response_model=ResilienceScore,
    include_in_schema=False,
)
def get_resilience() -> ResilienceScore:
    """
    Compute real-time supply chain resilience score (0-100) across 5 dimensions:
    inventory, fleet, routes, demand_coverage, connectivity, and return key driving factors.
    """
    try:
        current_state = world_state_service.get_state()
        return resilience_engine.calculate_resilience(current_state)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate resilience score: {str(exc)}",
        ) from exc










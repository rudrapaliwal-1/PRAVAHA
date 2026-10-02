"""
api/routes.py — API route definitions for MissionPath Logistics State.

Endpoints:
- GET /api/state
- GET /api/vehicles
- GET /api/depots
- GET /api/demand-points
- GET /api/routes
"""

from typing import List

from fastapi import APIRouter

from app.models.demand_point import DemandPoint
from app.models.depot import Depot
from app.models.logistics_state import LogisticsState
from app.models.route import Route
from app.models.vehicle import Vehicle
from app.simulation.world import world_state_service

router = APIRouter(prefix="/api", tags=["Logistics State"])


@router.get("/state", response_model=LogisticsState)
def get_logistics_state() -> LogisticsState:
    """Returns the complete current in-memory LogisticsState."""
    return world_state_service.get_state()


@router.get("/vehicles", response_model=List[Vehicle])
def get_vehicles() -> List[Vehicle]:
    """Returns the fleet of vehicles from the logistics state."""
    return list(world_state_service.get_state().vehicles.values())


@router.get("/depots", response_model=List[Depot])
def get_depots() -> List[Depot]:
    """Returns all supply depots from the logistics state."""
    return list(world_state_service.get_state().depots.values())


@router.get("/demand-points", response_model=List[DemandPoint])
def get_demand_points() -> List[DemandPoint]:
    """Returns all demand points from the logistics state."""
    return list(world_state_service.get_state().demand_points.values())


@router.get("/routes", response_model=List[Route])
def get_routes() -> List[Route]:
    """Returns all routes connecting the network nodes."""
    return list(world_state_service.get_state().routes.values())

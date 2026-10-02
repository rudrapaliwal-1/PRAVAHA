"""
models/disruption.py — Pydantic models for the MissionPath Disruption Simulation Engine.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DisruptionType(str, Enum):
    """Supported simulation disruption event categories."""
    BLOCK_ROUTE = "BLOCK_ROUTE"
    VEHICLE_FAILURE = "VEHICLE_FAILURE"
    DEMAND_SURGE = "DEMAND_SURGE"
    INVENTORY_SHORTAGE = "INVENTORY_SHORTAGE"
    NEW_EMERGENCY = "NEW_EMERGENCY"


class DisruptionRequest(BaseModel):
    """
    Request payload for POST /api/simulation/disruption.

    Attributes:
        type:        Type of disruption event to inject.
        target_id:   Identifier of the target entity (route, vehicle, depot, demand point).
        parameters:  Optional scenario customization parameters (e.g. surge multiplier, loss amount).
    """

    type: DisruptionType = Field(..., description="Category of disruption event")
    target_id: Optional[str] = Field(
        default=None,
        description="Identifier of the target entity (route_id, vehicle_id, depot_id, demand_point_id)",
    )
    parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Optional scenario tuning parameters (multipliers, coordinates, supply types, quantities)",
    )

    model_config = {"frozen": False}


class DisruptionResult(BaseModel):
    """
    Response payload describing the state transformation resulting from a simulated disruption.

    Attributes:
        event_id:           Unique event identifier (e.g. 'DISRUPT-1A2B3C').
        event_type:         Category of disruption applied.
        affected_entities:  List of IDs of affected network entities.
        state_changes:      Structured summary of properties mutated.
        timestamp:          UTC timestamp when the disruption was applied.
    """

    event_id: str = Field(..., description="Unique disruption event identifier")
    event_type: DisruptionType = Field(..., description="Type of disruption event injected")
    affected_entities: List[str] = Field(
        default_factory=list,
        description="Identifiers of entities modified or created",
    )
    state_changes: Dict[str, Any] = Field(
        default_factory=dict,
        description="Before/after properties and mutation details",
    )
    timestamp: datetime = Field(..., description="UTC timestamp of the disruption occurrence")

    model_config = {"frozen": False}

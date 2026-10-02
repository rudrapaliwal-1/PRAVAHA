"""
models/coa.py — Pydantic models for Courses of Action (COA) multi-plan generation.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

from app.models.common import RiskLevel
from app.models.disruption import DisruptionRequest
from app.models.logistics_state import LogisticsState
from app.models.optimization import OptimizationDelivery


class COAType(str, Enum):
    """Course of Action strategic trade-off profiles."""
    FASTEST = "FASTEST"
    LOWEST_RISK = "LOWEST_RISK"
    RESOURCE_EFFICIENT = "RESOURCE_EFFICIENT"


class CourseOfActionPlan(BaseModel):
    """
    A single feasible Course of Action (COA) logistics plan.

    Attributes:
        id:            Unique plan identifier (e.g. 'COA-FASTEST-9A4B').
        name:          COA profile name (FASTEST, LOWEST_RISK, RESOURCE_EFFICIENT).
        eta:           Total transit duration in hours across all assigned deliveries.
        distance:      Total distance traveled in kilometres across all deliveries.
        risk:          Average normalized risk score across assigned routes (0.0=Safe to 1.0=High).
        cost:          Estimated logistics operational expenditure.
        unmet_demand:  Total quantity of unfulfilled demand (units/kg).
        deliveries:    Complete schedule of vehicle assignments and route dispatches.
        status:        CP-SAT solver status (OPTIMAL, FEASIBLE, INFEASIBLE).
        description:   Human-readable explanation of strategic trade-offs for operators.
    """

    id: str = Field(..., description="Unique plan identifier")
    name: str = Field(..., description="COA strategy: FASTEST, LOWEST_RISK, or RESOURCE_EFFICIENT")
    eta: float = Field(..., ge=0.0, description="Total delivery transit duration in hours")
    distance: float = Field(..., ge=0.0, description="Total travel distance in km")
    risk: float = Field(..., ge=0.0, le=1.0, description="Average normalized route threat score (0.0 to 1.0)")
    cost: float = Field(..., ge=0.0, description="Estimated operational logistics cost")
    unmet_demand: float = Field(..., ge=0.0, description="Remaining unsupplied demand (units/kg)")
    deliveries: List[OptimizationDelivery] = Field(
        default_factory=list,
        description="Detailed delivery assignments computed by CP-SAT",
    )
    status: str = Field(default="OPTIMAL", description="Optimization feasibility status")
    description: Optional[str] = Field(
        default=None,
        description="Executive summary of trade-off rationale for human decision-makers",
    )

    model_config = {"frozen": False}


class CoursesOfActionRequest(BaseModel):
    """
    Request model for POST /api/courses-of-action.
    """

    state: Optional[LogisticsState] = Field(
        default=None,
        description="Optional custom LogisticsState. If omitted, active in-memory simulation state is used.",
    )
    disruption: Optional[DisruptionRequest] = Field(
        default=None,
        description="Optional disruption event to apply before generating COA candidates.",
    )

    model_config = {"frozen": False}


class CoursesOfActionResponse(BaseModel):
    """
    Response model for POST /api/courses-of-action containing 3 distinct feasible COAs.
    """

    plans: List[CourseOfActionPlan] = Field(
        default_factory=list,
        description="List of 3 distinct feasible Courses of Action (FASTEST, LOWEST_RISK, RESOURCE_EFFICIENT)",
    )
    generated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC generation timestamp",
    )

    model_config = {"frozen": False}

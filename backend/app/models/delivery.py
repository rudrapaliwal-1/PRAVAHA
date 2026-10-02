"""
models/delivery.py — Delivery model for logistics optimization.

A delivery is an assignment: vehicle X carries supply Y from depot Z
to demand point W via route R, with an estimated time of arrival.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.common import DeliveryStatus, SupplyType


class Delivery(BaseModel):
    """
    A single supply delivery task.

    Attributes:
        vehicle_id:      ID of the vehicle executing this delivery.
        depot_id:        ID of the source depot.
        demand_point_id: ID of the destination demand point.
        supply_type:     Category of supply being delivered.
        quantity:        Amount to deliver (kg or units).
        route_id:        ID of the route taken.
        eta:             Estimated time of arrival (UTC).
                         None until the optimizer calculates it.
        status:          Current lifecycle state of the delivery.
    """

    vehicle_id: str = Field(..., min_length=1, description="Vehicle executing this delivery")
    depot_id: str = Field(..., min_length=1, description="Source depot ID")
    demand_point_id: str = Field(..., min_length=1, description="Destination demand point ID")
    supply_type: SupplyType = Field(..., description="Type of supply being delivered")
    quantity: float = Field(..., gt=0, description="Quantity to deliver (kg or units)")
    route_id: str = Field(..., min_length=1, description="Route taken for this delivery")
    eta: Optional[datetime] = Field(
        default=None,
        description="Estimated time of arrival (UTC). Set by optimizer.",
    )
    status: DeliveryStatus = Field(
        default=DeliveryStatus.PENDING,
        description="Lifecycle state of this delivery",
    )

    @field_validator("vehicle_id", "depot_id", "demand_point_id", "route_id")
    @classmethod
    def ids_must_be_stripped(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("ID field must not be blank")
        return v

    @property
    def is_active(self) -> bool:
        """True if the delivery is still in progress."""
        return self.status in (DeliveryStatus.PENDING, DeliveryStatus.IN_TRANSIT)

    @property
    def is_terminal(self) -> bool:
        """True if the delivery has reached a final state."""
        return self.status in (
            DeliveryStatus.DELIVERED,
            DeliveryStatus.FAILED,
            DeliveryStatus.CANCELLED,
        )

    model_config = {"frozen": False}

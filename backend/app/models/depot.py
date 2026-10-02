"""
models/depot.py — Depot model for logistics optimization.

A depot is a supply node (warehouse, forward operating base, staging area)
that holds inventory and dispatches vehicles.
"""

from typing import Dict

from pydantic import BaseModel, Field, field_validator

from app.models.common import SupplyType
from app.models.vehicle import Location


class Depot(BaseModel):
    """
    A supply origin node in the logistics network.

    Attributes:
        id:        Unique depot identifier (e.g. "DP-001").
        location:  GPS coordinates of the depot.
        inventory: Map of SupplyType → quantity available (in kg or units).
    """

    id: str = Field(..., min_length=1, description="Unique depot identifier")
    location: Location = Field(..., description="GPS position of the depot")
    inventory: Dict[SupplyType, float] = Field(
        default_factory=dict,
        description="Available stock per supply type (kg or units)",
    )

    @field_validator("id")
    @classmethod
    def id_must_be_stripped(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Depot id must not be blank")
        return v

    @field_validator("inventory")
    @classmethod
    def quantities_must_be_non_negative(cls, v: Dict[SupplyType, float]) -> Dict[SupplyType, float]:
        for supply_type, qty in v.items():
            if qty < 0:
                raise ValueError(
                    f"Inventory quantity for '{supply_type}' must be >= 0, got {qty}"
                )
        return v

    def total_stock(self) -> float:
        """Return the total inventory across all supply types."""
        return sum(self.inventory.values())

    def has_stock(self, supply_type: SupplyType, quantity: float) -> bool:
        """Check whether the depot can fulfil a given quantity of a supply type."""
        return self.inventory.get(supply_type, 0.0) >= quantity

    model_config = {"frozen": False}

"""
models/vehicle.py — Vehicle model for logistics optimization.

A vehicle is a transport unit (truck, helicopter, boat, drone, etc.)
that carries supplies from depots to demand points.
"""

from pydantic import BaseModel, Field, field_validator


class Location(BaseModel):
    """Geographic coordinate pair (WGS-84 decimal degrees)."""
    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    lon: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")

    def __repr__(self) -> str:
        return f"Location(lat={self.lat}, lon={self.lon})"


class Vehicle(BaseModel):
    """
    A transport unit in the logistics network.

    Attributes:
        id:               Unique vehicle identifier (e.g. "VH-001").
        capacity:         Maximum load in kg this vehicle can carry.
        current_location: Current GPS position of the vehicle.
        available:        Whether the vehicle is free to accept a new mission.
        fuel_level:       Remaining fuel as a percentage [0.0 – 100.0].
        speed:            Cruising speed in km/h.
    """

    id: str = Field(..., min_length=1, description="Unique vehicle identifier")
    capacity: float = Field(..., gt=0, description="Max load capacity in kg")
    current_location: Location = Field(..., description="Current GPS position")
    available: bool = Field(default=True, description="True if vehicle is free for assignment")
    fuel_level: float = Field(
        default=100.0,
        ge=0.0,
        le=100.0,
        description="Fuel remaining as a percentage (0–100)",
    )
    speed: float = Field(..., gt=0, description="Cruising speed in km/h")

    @field_validator("id")
    @classmethod
    def id_must_be_stripped(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Vehicle id must not be blank")
        return v

    @property
    def is_operational(self) -> bool:
        """A vehicle is operational if it has fuel and is marked available."""
        return self.available and self.fuel_level > 0.0

    model_config = {"frozen": False}

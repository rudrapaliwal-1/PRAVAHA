"""
tests/test_models.py

Validates that all Pydantic models can be instantiated with valid data,
that field validators fire correctly on bad data, and that cross-entity
helpers on LogisticsState work as expected.

Run with:
    .venv\\Scripts\\python.exe -m pytest tests/ -v
"""

import pytest
from datetime import datetime, timezone
from pydantic import ValidationError

from app.models import (
    Delivery,
    DeliveryStatus,
    DemandPoint,
    Depot,
    Location,
    LogisticsState,
    Priority,
    RiskLevel,
    Route,
    SupplyType,
    Vehicle,
)


# ---------------------------------------------------------------------------
# Fixtures — reusable valid objects
# ---------------------------------------------------------------------------

@pytest.fixture
def location_delhi() -> Location:
    return Location(lat=28.6139, lon=77.2090)


@pytest.fixture
def location_mumbai() -> Location:
    return Location(lat=19.0760, lon=72.8777)


@pytest.fixture
def valid_vehicle(location_delhi) -> Vehicle:
    return Vehicle(
        id="VH-001",
        capacity=5000.0,          # 5 tonnes
        current_location=location_delhi,
        available=True,
        fuel_level=85.0,
        speed=80.0,               # km/h
    )


@pytest.fixture
def valid_depot(location_delhi) -> Depot:
    return Depot(
        id="DP-001",
        location=location_delhi,
        inventory={
            SupplyType.FOOD: 2000.0,
            SupplyType.WATER: 5000.0,
            SupplyType.MEDICINE: 500.0,
        },
    )


@pytest.fixture
def valid_demand_point(location_mumbai) -> DemandPoint:
    return DemandPoint(
        id="DM-001",
        location=location_mumbai,
        required_supplies={
            SupplyType.FOOD: 800.0,
            SupplyType.WATER: 2000.0,
        },
        priority=Priority.HIGH,
        deadline=datetime(2026, 12, 31, 18, 0, 0, tzinfo=timezone.utc),
        consumption_rate={
            SupplyType.FOOD: 50.0,    # 50 kg/hour
            SupplyType.WATER: 100.0,  # 100 L/hour
        },
    )


@pytest.fixture
def valid_route(location_delhi, location_mumbai) -> Route:
    return Route(
        id="RT-001",
        source=location_delhi,
        destination=location_mumbai,
        distance=1400.0,    # ~1400 km Delhi → Mumbai
        travel_time=17.5,   # ~17.5 hours by road
        risk=RiskLevel.LOW,
        available=True,
    )


@pytest.fixture
def valid_delivery() -> Delivery:
    return Delivery(
        vehicle_id="VH-001",
        depot_id="DP-001",
        demand_point_id="DM-001",
        supply_type=SupplyType.FOOD,
        quantity=800.0,
        route_id="RT-001",
        eta=datetime(2026, 12, 30, 12, 0, 0, tzinfo=timezone.utc),
        status=DeliveryStatus.PENDING,
    )


# ===========================================================================
# 1. Location
# ===========================================================================

class TestLocation:
    def test_valid_location(self):
        loc = Location(lat=28.6139, lon=77.2090)
        assert loc.lat == 28.6139
        assert loc.lon == 77.2090

    def test_invalid_lat_too_high(self):
        with pytest.raises(ValidationError):
            Location(lat=91.0, lon=0.0)

    def test_invalid_lon_too_low(self):
        with pytest.raises(ValidationError):
            Location(lat=0.0, lon=-181.0)


# ===========================================================================
# 2. Vehicle
# ===========================================================================

class TestVehicle:
    def test_valid_vehicle(self, valid_vehicle):
        assert valid_vehicle.id == "VH-001"
        assert valid_vehicle.capacity == 5000.0
        assert valid_vehicle.fuel_level == 85.0
        assert valid_vehicle.speed == 80.0
        assert valid_vehicle.available is True

    def test_is_operational(self, valid_vehicle):
        assert valid_vehicle.is_operational is True

    def test_not_operational_when_no_fuel(self, valid_vehicle):
        valid_vehicle.fuel_level = 0.0
        assert valid_vehicle.is_operational is False

    def test_not_operational_when_unavailable(self, valid_vehicle):
        valid_vehicle.available = False
        assert valid_vehicle.is_operational is False

    def test_zero_capacity_rejected(self, location_delhi):
        with pytest.raises(ValidationError):
            Vehicle(
                id="VH-BAD",
                capacity=0,
                current_location=location_delhi,
                speed=80.0,
            )

    def test_fuel_over_100_rejected(self, location_delhi):
        with pytest.raises(ValidationError):
            Vehicle(
                id="VH-BAD",
                capacity=1000,
                current_location=location_delhi,
                fuel_level=101.0,
                speed=80.0,
            )

    def test_blank_id_rejected(self, location_delhi):
        with pytest.raises(ValidationError):
            Vehicle(id="   ", capacity=1000, current_location=location_delhi, speed=80.0)


# ===========================================================================
# 3. Depot
# ===========================================================================

class TestDepot:
    def test_valid_depot(self, valid_depot):
        assert valid_depot.id == "DP-001"
        assert valid_depot.inventory[SupplyType.FOOD] == 2000.0
        assert valid_depot.total_stock() == 7500.0

    def test_has_stock_true(self, valid_depot):
        assert valid_depot.has_stock(SupplyType.FOOD, 1500.0) is True

    def test_has_stock_false(self, valid_depot):
        assert valid_depot.has_stock(SupplyType.FOOD, 9999.0) is False

    def test_negative_inventory_rejected(self, location_delhi):
        with pytest.raises(ValidationError):
            Depot(
                id="DP-BAD",
                location=location_delhi,
                inventory={SupplyType.FOOD: -100.0},
            )

    def test_empty_inventory_is_valid(self, location_delhi):
        depot = Depot(id="DP-EMPTY", location=location_delhi)
        assert depot.total_stock() == 0.0


# ===========================================================================
# 4. DemandPoint
# ===========================================================================

class TestDemandPoint:
    def test_valid_demand_point(self, valid_demand_point):
        assert valid_demand_point.id == "DM-001"
        assert valid_demand_point.priority == Priority.HIGH
        assert valid_demand_point.total_required() == 2800.0

    def test_is_critical(self, valid_demand_point):
        assert valid_demand_point.is_critical is False
        valid_demand_point.priority = Priority.CRITICAL
        assert valid_demand_point.is_critical is True

    def test_negative_required_supplies_rejected(self, location_mumbai):
        with pytest.raises(ValidationError):
            DemandPoint(
                id="DM-BAD",
                location=location_mumbai,
                required_supplies={SupplyType.WATER: -50.0},
            )

    def test_no_deadline_is_valid(self, location_mumbai):
        dp = DemandPoint(id="DM-NODL", location=location_mumbai)
        assert dp.deadline is None


# ===========================================================================
# 5. Route
# ===========================================================================

class TestRoute:
    def test_valid_route(self, valid_route):
        assert valid_route.id == "RT-001"
        assert valid_route.distance == 1400.0
        assert valid_route.risk == RiskLevel.LOW
        assert valid_route.is_usable is True

    def test_risk_multiplier(self, valid_route):
        assert valid_route.risk_multiplier == 1.2   # LOW

    def test_blocked_route_not_usable(self, valid_route):
        valid_route.risk = RiskLevel.BLOCKED
        assert valid_route.is_usable is False

    def test_unavailable_route_not_usable(self, valid_route):
        valid_route.available = False
        assert valid_route.is_usable is False

    def test_impossible_speed_rejected(self, location_delhi, location_mumbai):
        # 1 km in 17.5 hours → 0.057 km/h — absurdly slow
        with pytest.raises(ValidationError, match="Implied speed"):
            Route(
                id="RT-BAD",
                source=location_delhi,
                destination=location_mumbai,
                distance=1.0,
                travel_time=17.5,
                risk=RiskLevel.SAFE,
            )


# ===========================================================================
# 6. Delivery
# ===========================================================================

class TestDelivery:
    def test_valid_delivery(self, valid_delivery):
        assert valid_delivery.vehicle_id == "VH-001"
        assert valid_delivery.quantity == 800.0
        assert valid_delivery.status == DeliveryStatus.PENDING

    def test_is_active(self, valid_delivery):
        assert valid_delivery.is_active is True
        assert valid_delivery.is_terminal is False

    def test_delivered_is_terminal(self, valid_delivery):
        valid_delivery.status = DeliveryStatus.DELIVERED
        assert valid_delivery.is_terminal is True
        assert valid_delivery.is_active is False

    def test_zero_quantity_rejected(self):
        with pytest.raises(ValidationError):
            Delivery(
                vehicle_id="VH-001",
                depot_id="DP-001",
                demand_point_id="DM-001",
                supply_type=SupplyType.FOOD,
                quantity=0,
                route_id="RT-001",
            )


# ===========================================================================
# 7. LogisticsState
# ===========================================================================

class TestLogisticsState:
    def test_empty_state(self):
        state = LogisticsState()
        assert len(state.vehicles) == 0
        s = state.summary()
        assert s["vehicles"]["total"] == 0

    def test_full_valid_state(
        self, valid_vehicle, valid_depot, valid_demand_point, valid_route, valid_delivery
    ):
        state = LogisticsState(
            vehicles={"VH-001": valid_vehicle},
            depots={"DP-001": valid_depot},
            demand_points={"DM-001": valid_demand_point},
            routes={"RT-001": valid_route},
            deliveries=[valid_delivery],
        )
        assert len(state.vehicles) == 1
        assert len(state.available_vehicles()) == 1
        assert len(state.usable_routes()) == 1
        assert len(state.active_deliveries()) == 1

        s = state.summary()
        assert s["depots"] == 1
        assert s["deliveries"]["active"] == 1

    def test_delivery_with_bad_vehicle_ref_rejected(
        self, valid_vehicle, valid_depot, valid_demand_point, valid_route, valid_delivery
    ):
        # Delivery references VH-999 which doesn't exist in vehicles dict
        bad_delivery = valid_delivery.model_copy(update={"vehicle_id": "VH-999"})
        with pytest.raises(ValidationError, match="unknown vehicle_id"):
            LogisticsState(
                vehicles={"VH-001": valid_vehicle},
                depots={"DP-001": valid_depot},
                demand_points={"DM-001": valid_demand_point},
                routes={"RT-001": valid_route},
                deliveries=[bad_delivery],
            )

    def test_unavailable_vehicle_excluded(self, valid_vehicle, location_delhi):
        valid_vehicle.available = False
        state = LogisticsState(vehicles={"VH-001": valid_vehicle})
        assert len(state.available_vehicles()) == 0

    def test_blocked_route_excluded_from_usable(self, valid_route):
        valid_route.risk = RiskLevel.BLOCKED
        state = LogisticsState(routes={"RT-001": valid_route})
        assert len(state.usable_routes()) == 0

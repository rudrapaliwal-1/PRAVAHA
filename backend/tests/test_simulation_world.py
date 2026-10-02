"""
tests/test_simulation_world.py

Validates the simulated logistics world state:
- Exact counts: 3 depots, 10 vehicles, 6 demand points, 12 routes
- Supply types: Medical/Medicine, Water, Food, Fuel, Equipment
- Deterministic reproducibility
- Validity of all attributes and Pydantic constraints
"""

import pytest

from app.models.common import Priority, RiskLevel, SupplyType
from app.models.logistics_state import LogisticsState
from app.simulation.world import (
    WorldStateService,
    create_initial_logistics_state,
    world_state_service,
)


@pytest.fixture
def state() -> LogisticsState:
    return create_initial_logistics_state()


class TestSimulationWorldCounts:
    def test_state_loads_correctly(self, state: LogisticsState):
        """Verifies state is an instance of LogisticsState and summary matches."""
        assert isinstance(state, LogisticsState)
        summary = state.summary()
        assert summary["depots"] == 3
        assert summary["vehicles"]["total"] == 10
        assert summary["demand_points"] == 6
        assert summary["routes"]["total"] == 12

    def test_expected_number_of_depots_exists(self, state: LogisticsState):
        """Must have exactly 3 depots with distinct IDs and inventories."""
        assert len(state.depots) == 3
        expected_depots = {"DEPOT-ALPHA", "DEPOT-BRAVO", "DEPOT-CHARLIE"}
        assert set(state.depots.keys()) == expected_depots

        # Check required supply types exist across depots
        required_supplies = {
            SupplyType.MEDICAL,
            SupplyType.WATER,
            SupplyType.FOOD,
            SupplyType.FUEL,
            SupplyType.EQUIPMENT,
        }
        for depot_id, depot in state.depots.items():
            assert depot.id == depot_id
            assert depot.location.lat != 0.0
            assert depot.location.lon != 0.0
            for st in required_supplies:
                assert st in depot.inventory
                assert depot.inventory[st] > 0

        # Verify inventories differ across depots
        inventories = [d.inventory for d in state.depots.values()]
        assert inventories[0] != inventories[1]
        assert inventories[1] != inventories[2]

    def test_expected_number_of_vehicles_exists(self, state: LogisticsState):
        """Must have exactly 10 vehicles with required attributes."""
        assert len(state.vehicles) == 10
        for i in range(1, 11):
            vid = f"VEH-{i:02d}"
            assert vid in state.vehicles
            vehicle = state.vehicles[vid]
            assert vehicle.id == vid
            assert vehicle.capacity > 0
            assert vehicle.current_location is not None
            assert 0.0 <= vehicle.fuel_level <= 100.0
            assert vehicle.speed > 0
            assert isinstance(vehicle.available, bool)

        # Confirm some vehicles are available and operational
        available = state.available_vehicles()
        assert len(available) >= 8

    def test_expected_number_of_demand_points_exists(self, state: LogisticsState):
        """Must have exactly 6 demand points with required attributes."""
        assert len(state.demand_points) == 6
        for i in range(1, 7):
            dpid = f"DEMAND-{i:02d}"
            assert dpid in state.demand_points
            dp = state.demand_points[dpid]
            assert dp.id == dpid
            assert dp.location is not None
            assert len(dp.required_supplies) > 0
            assert isinstance(dp.priority, Priority)
            assert dp.deadline is not None
            assert len(dp.consumption_rate) > 0

    def test_expected_number_of_routes_exists(self, state: LogisticsState):
        """Must have exactly 12 routes connecting nodes with distance, time, and risk."""
        assert len(state.routes) == 12
        for i in range(1, 13):
            rid = f"ROUTE-{i:02d}"
            assert rid in state.routes
            route = state.routes[rid]
            assert route.id == rid
            assert route.source is not None
            assert route.destination is not None
            assert route.distance > 0
            assert route.travel_time > 0
            assert isinstance(route.risk, RiskLevel)
            assert isinstance(route.available, bool)

        # Check usable routes filter
        usable = state.usable_routes()
        assert 0 < len(usable) <= 12


class TestSimulationWorldDeterminism:
    def test_deterministic_generation(self):
        """Multiple runs must produce identical states."""
        state1 = create_initial_logistics_state()
        state2 = create_initial_logistics_state()
        assert state1.model_dump() == state2.model_dump()

    def test_world_state_service_singleton(self):
        """Service provides access and reset correctly."""
        service = WorldStateService()
        st1 = service.get_state()
        assert len(st1.vehicles) == 10
        st2 = service.reset_state()
        assert len(st2.vehicles) == 10
        assert world_state_service.get_state() is not None

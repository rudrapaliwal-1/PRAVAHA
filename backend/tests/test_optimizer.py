"""
tests/test_optimizer.py

Comprehensive tests for Google OR-Tools CP-SAT Logistics Optimizer:
- Valid solution
- Insufficient depot inventory
- Insufficient vehicle capacity
- Unavailable vehicle / zero fuel
- Blocked / unavailable route
- Priority-driven demand allocation (CRITICAL vs LOW)
- Vehicle single-delivery constraint enforcement
- Simulation world state optimization
- POST /api/optimize endpoint integration
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.models.common import Priority, RiskLevel, SupplyType
from app.models.demand_point import DemandPoint
from app.models.depot import Depot
from app.models.logistics_state import LogisticsState
from app.models.optimization import OptimizationResult
from app.models.route import Route
from app.models.vehicle import Location, Vehicle
from app.optimizer.service import optimize_logistics, optimizer_service
from app.simulation.world import create_initial_logistics_state

client = TestClient(app)


# ---------------------------------------------------------------------------
# Test Fixtures for Small Deterministic Scenarios
# ---------------------------------------------------------------------------

@pytest.fixture
def loc_depot() -> Location:
    return Location(lat=30.0, lon=78.0)


@pytest.fixture
def loc_demand() -> Location:
    return Location(lat=30.5, lon=78.5)


@pytest.fixture
def small_deterministic_state(loc_depot, loc_demand) -> LogisticsState:
    """A minimal, deterministic state with 1 vehicle, 1 depot, 1 demand point, 1 route."""
    depot = Depot(
        id="DEPOT-01",
        location=loc_depot,
        inventory={
            SupplyType.FOOD: 500.0,
            SupplyType.WATER: 1000.0,
        },
    )

    vehicle = Vehicle(
        id="VEH-01",
        capacity=300.0,
        current_location=loc_depot,
        available=True,
        fuel_level=100.0,
        speed=60.0,
    )

    demand_point = DemandPoint(
        id="DEMAND-01",
        location=loc_demand,
        required_supplies={
            SupplyType.FOOD: 200.0,
        },
        priority=Priority.HIGH,
        deadline=datetime(2026, 10, 3, 12, 0, 0, tzinfo=timezone.utc),
    )

    route = Route(
        id="ROUTE-01",
        source=loc_depot,
        destination=loc_demand,
        distance=50.0,
        travel_time=1.0,
        risk=RiskLevel.SAFE,
        available=True,
    )

    return LogisticsState(
        vehicles={vehicle.id: vehicle},
        depots={depot.id: depot},
        demand_points={demand_point.id: demand_point},
        routes={route.id: route},
    )


class TestLogisticsOptimizerScenarios:
    def test_valid_solution(self, small_deterministic_state):
        """Standard valid scenario with sufficient inventory, capacity, and usable route."""
        result = optimize_logistics(small_deterministic_state)

        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 1

        delivery = result.deliveries[0]
        assert delivery.vehicle_id == "VEH-01"
        assert delivery.depot_id == "DEPOT-01"
        assert delivery.demand_point_id == "DEMAND-01"
        assert delivery.supply_type == SupplyType.FOOD
        assert delivery.quantity == 200.0
        assert delivery.route_id == "ROUTE-01"
        assert delivery.distance == 50.0
        assert delivery.eta == 1.0

        assert result.unmet_demand["DEMAND-01"]["food"] == 0.0
        assert result.total_distance == 50.0
        assert result.total_eta == 1.0

    def test_insufficient_inventory(self, small_deterministic_state):
        """When depot inventory is less than demand, delivery cannot exceed inventory."""
        small_deterministic_state.depots["DEPOT-01"].inventory[SupplyType.FOOD] = 80.0

        result = optimize_logistics(small_deterministic_state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 1

        delivery = result.deliveries[0]
        assert delivery.quantity == 80.0
        assert result.unmet_demand["DEMAND-01"]["food"] == 120.0

    def test_insufficient_vehicle_capacity(self, small_deterministic_state):
        """When vehicle capacity is less than demand, delivery cannot exceed capacity."""
        small_deterministic_state.vehicles["VEH-01"].capacity = 75.0

        result = optimize_logistics(small_deterministic_state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 1

        delivery = result.deliveries[0]
        assert delivery.quantity == 75.0
        assert result.unmet_demand["DEMAND-01"]["food"] == 125.0

    def test_unavailable_vehicle(self, small_deterministic_state):
        """Unavailable or un-fueled vehicles cannot be assigned."""
        small_deterministic_state.vehicles["VEH-01"].available = False

        result = optimize_logistics(small_deterministic_state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 0
        assert result.unmet_demand["DEMAND-01"]["food"] == 200.0
        assert result.total_distance == 0.0

    def test_zero_fuel_vehicle_cannot_be_assigned(self, small_deterministic_state):
        """Vehicle with 0 fuel is not operational and cannot be assigned."""
        small_deterministic_state.vehicles["VEH-01"].fuel_level = 0.0

        result = optimize_logistics(small_deterministic_state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 0
        assert result.unmet_demand["DEMAND-01"]["food"] == 200.0

    def test_blocked_route(self, small_deterministic_state):
        """Blocked or unavailable route prevents delivery between connected nodes."""
        small_deterministic_state.routes["ROUTE-01"].risk = RiskLevel.BLOCKED
        small_deterministic_state.routes["ROUTE-01"].available = False

        result = optimize_logistics(small_deterministic_state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 0
        assert result.unmet_demand["DEMAND-01"]["food"] == 200.0

    def test_priority_demand_preference(self, loc_depot):
        """When supply/capacity is scarce, higher priority demand is fulfilled first."""
        loc_crit = Location(lat=30.6, lon=78.6)
        loc_low = Location(lat=30.7, lon=78.7)

        depot = Depot(
            id="DEPOT-01",
            location=loc_depot,
            inventory={SupplyType.MEDICINE: 100.0},
        )
        vehicle = Vehicle(
            id="VEH-01",
            capacity=100.0,
            current_location=loc_depot,
            available=True,
            fuel_level=100.0,
            speed=60.0,
        )
        dp_critical = DemandPoint(
            id="DEMAND-CRIT",
            location=loc_crit,
            required_supplies={SupplyType.MEDICINE: 100.0},
            priority=Priority.CRITICAL,
        )
        dp_low = DemandPoint(
            id="DEMAND-LOW",
            location=loc_low,
            required_supplies={SupplyType.MEDICINE: 100.0},
            priority=Priority.LOW,
        )
        route_crit = Route(
            id="ROUTE-CRIT",
            source=loc_depot,
            destination=loc_crit,
            distance=40.0,
            travel_time=0.8,
            risk=RiskLevel.SAFE,
        )
        route_low = Route(
            id="ROUTE-LOW",
            source=loc_depot,
            destination=loc_low,
            distance=40.0,
            travel_time=0.8,
            risk=RiskLevel.SAFE,
        )

        state = LogisticsState(
            vehicles={vehicle.id: vehicle},
            depots={depot.id: depot},
            demand_points={dp_critical.id: dp_critical, dp_low.id: dp_low},
            routes={route_crit.id: route_crit, route_low.id: route_low},
        )

        result = optimize_logistics(state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 1
        assert result.deliveries[0].demand_point_id == "DEMAND-CRIT"
        assert result.unmet_demand["DEMAND-CRIT"]["medicine"] == 0.0
        assert result.unmet_demand["DEMAND-LOW"]["medicine"] == 100.0

    def test_vehicle_at_most_one_delivery(self, loc_depot, loc_demand):
        """Confirms a vehicle cannot perform more than 1 delivery."""
        loc_demand_2 = Location(lat=30.8, lon=78.8)
        depot = Depot(
            id="DEPOT-01",
            location=loc_depot,
            inventory={SupplyType.FOOD: 1000.0},
        )
        # Only 1 vehicle available
        vehicle = Vehicle(
            id="VEH-01",
            capacity=500.0,
            current_location=loc_depot,
            available=True,
            fuel_level=100.0,
            speed=60.0,
        )
        dp1 = DemandPoint(
            id="DP-1",
            location=loc_demand,
            required_supplies={SupplyType.FOOD: 100.0},
            priority=Priority.HIGH,
        )
        dp2 = DemandPoint(
            id="DP-2",
            location=loc_demand_2,
            required_supplies={SupplyType.FOOD: 100.0},
            priority=Priority.HIGH,
        )
        r1 = Route(
            id="R-1",
            source=loc_depot,
            destination=loc_demand,
            distance=20.0,
            travel_time=0.5,
        )
        r2 = Route(
            id="R-2",
            source=loc_depot,
            destination=loc_demand_2,
            distance=25.0,
            travel_time=0.6,
        )

        state = LogisticsState(
            vehicles={vehicle.id: vehicle},
            depots={depot.id: depot},
            demand_points={dp1.id: dp1, dp2.id: dp2},
            routes={r1.id: r1, r2.id: r2},
        )

        result = optimize_logistics(state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 1
        assert len({d.vehicle_id for d in result.deliveries}) == 1


class TestBlock6InventoryAllocation:
    def test_multiple_supply_types(self, loc_depot, loc_demand):
        """Test allocating all 5 supply types (Medical, Water, Food, Fuel, Equipment) using separate vehicles."""
        depot = Depot(
            id="DEPOT-MULTI",
            location=loc_depot,
            inventory={
                SupplyType.MEDICINE: 500.0,
                SupplyType.WATER: 5000.0,
                SupplyType.FOOD: 3000.0,
                SupplyType.FUEL: 2000.0,
                SupplyType.EQUIPMENT: 1000.0,
            },
        )
        dp = DemandPoint(
            id="DEMAND-MULTI",
            location=loc_demand,
            required_supplies={
                SupplyType.MEDICINE: 50.0,
                SupplyType.WATER: 1000.0,
                SupplyType.FOOD: 800.0,
                SupplyType.FUEL: 400.0,
                SupplyType.EQUIPMENT: 200.0,
            },
            priority=Priority.HIGH,
        )
        route = Route(
            id="ROUTE-MULTI",
            source=loc_depot,
            destination=loc_demand,
            distance=30.0,
            travel_time=0.6,
        )
        # 5 vehicles capable of carrying the supplies
        vehicles = {
            f"VEH-{i}": Vehicle(
                id=f"VEH-{i}",
                capacity=1500.0,
                current_location=loc_depot,
                available=True,
                fuel_level=100.0,
                speed=50.0,
            )
            for i in range(1, 6)
        }

        state = LogisticsState(
            vehicles=vehicles,
            depots={depot.id: depot},
            demand_points={dp.id: dp},
            routes={route.id: route},
        )

        result = optimize_logistics(state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 5

        delivered_supplies = {d.supply_type: d.quantity for d in result.deliveries}
        assert delivered_supplies[SupplyType.MEDICINE] == 50.0
        assert delivered_supplies[SupplyType.WATER] == 1000.0
        assert delivered_supplies[SupplyType.FOOD] == 800.0
        assert delivered_supplies[SupplyType.FUEL] == 400.0
        assert delivered_supplies[SupplyType.EQUIPMENT] == 200.0

        assert result.total_supplied == 2450.0
        assert result.total_unmet_demand == 0.0

        # Check inventory used and remaining
        inv_used = result.inventory_used["DEPOT-MULTI"]
        assert inv_used["medicine"] == 50.0
        assert inv_used["water"] == 1000.0
        assert inv_used["food"] == 800.0
        assert inv_used["fuel"] == 400.0
        assert inv_used["equipment"] == 200.0

        inv_rem = result.inventory_remaining["DEPOT-MULTI"]
        assert inv_rem["medicine"] == 450.0
        assert inv_rem["water"] == 4000.0
        assert inv_rem["food"] == 2200.0
        assert inv_rem["fuel"] == 1600.0
        assert inv_rem["equipment"] == 800.0

    def test_limited_depot_inventory(self, loc_depot, loc_demand):
        """Depot inventory acts as a hard constraint and cannot become negative."""
        depot = Depot(
            id="DEPOT-LIM",
            location=loc_depot,
            inventory={
                SupplyType.FOOD: 40.0,
                SupplyType.WATER: 60.0,
            },
        )
        dp = DemandPoint(
            id="DEMAND-LIM",
            location=loc_demand,
            required_supplies={
                SupplyType.FOOD: 100.0,
                SupplyType.WATER: 100.0,
            },
            priority=Priority.CRITICAL,
        )
        route = Route(
            id="ROUTE-LIM",
            source=loc_depot,
            destination=loc_demand,
            distance=20.0,
            travel_time=0.5,
        )
        vehicles = {
            "VEH-1": Vehicle(id="VEH-1", capacity=500.0, current_location=loc_depot, speed=60.0),
            "VEH-2": Vehicle(id="VEH-2", capacity=500.0, current_location=loc_depot, speed=60.0),
        }

        state = LogisticsState(
            vehicles=vehicles,
            depots={depot.id: depot},
            demand_points={dp.id: dp},
            routes={route.id: route},
        )

        result = optimize_logistics(state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 2

        delivered = {d.supply_type: d.quantity for d in result.deliveries}
        assert delivered[SupplyType.FOOD] == 40.0
        assert delivered[SupplyType.WATER] == 60.0

        # Unmet demand
        assert result.unmet_demand["DEMAND-LIM"]["food"] == 60.0
        assert result.unmet_demand["DEMAND-LIM"]["water"] == 40.0
        assert result.total_supplied == 100.0
        assert result.total_unmet_demand == 100.0

        # Inventory cannot be negative
        assert result.inventory_used["DEPOT-LIM"]["food"] == 40.0
        assert result.inventory_remaining["DEPOT-LIM"]["food"] == 0.0
        assert result.inventory_used["DEPOT-LIM"]["water"] == 60.0
        assert result.inventory_remaining["DEPOT-LIM"]["water"] == 0.0

    def test_multiple_depots_supplying_different_locations(self):
        """Multiple depots supply different demand locations across the network."""
        loc_depot_a = Location(lat=30.1, lon=78.1)
        loc_depot_b = Location(lat=30.2, lon=78.2)
        loc_dp_1 = Location(lat=30.5, lon=78.5)
        loc_dp_2 = Location(lat=30.6, lon=78.6)

        depot_a = Depot(
            id="DEPOT-A",
            location=loc_depot_a,
            inventory={SupplyType.MEDICINE: 500.0, SupplyType.WATER: 1000.0},
        )
        depot_b = Depot(
            id="DEPOT-B",
            location=loc_depot_b,
            inventory={SupplyType.FOOD: 600.0, SupplyType.FUEL: 800.0},
        )
        dp1 = DemandPoint(
            id="DEMAND-1",
            location=loc_dp_1,
            required_supplies={SupplyType.MEDICINE: 100.0, SupplyType.WATER: 300.0},
            priority=Priority.HIGH,
        )
        dp2 = DemandPoint(
            id="DEMAND-2",
            location=loc_dp_2,
            required_supplies={SupplyType.FOOD: 200.0, SupplyType.FUEL: 250.0},
            priority=Priority.HIGH,
        )
        route_a1 = Route(id="RT-A1", source=loc_depot_a, destination=loc_dp_1, distance=25.0, travel_time=0.5)
        route_b2 = Route(id="RT-B2", source=loc_depot_b, destination=loc_dp_2, distance=35.0, travel_time=0.7)

        vehicles = {
            "VEH-A1": Vehicle(id="VEH-A1", capacity=500.0, current_location=loc_depot_a, speed=50.0),
            "VEH-A2": Vehicle(id="VEH-A2", capacity=500.0, current_location=loc_depot_a, speed=50.0),
            "VEH-B1": Vehicle(id="VEH-B1", capacity=500.0, current_location=loc_depot_b, speed=50.0),
            "VEH-B2": Vehicle(id="VEH-B2", capacity=500.0, current_location=loc_depot_b, speed=50.0),
        }

        state = LogisticsState(
            vehicles=vehicles,
            depots={depot_a.id: depot_a, depot_b.id: depot_b},
            demand_points={dp1.id: dp1, dp2.id: dp2},
            routes={route_a1.id: route_a1, route_b2.id: route_b2},
        )

        result = optimize_logistics(state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 4

        # Verify sources
        a_deliveries = [d for d in result.deliveries if d.depot_id == "DEPOT-A"]
        b_deliveries = [d for d in result.deliveries if d.depot_id == "DEPOT-B"]
        assert len(a_deliveries) == 2
        assert len(b_deliveries) == 2

        assert all(d.demand_point_id == "DEMAND-1" for d in a_deliveries)
        assert all(d.demand_point_id == "DEMAND-2" for d in b_deliveries)

        assert result.total_unmet_demand == 0.0
        assert result.total_supplied == 850.0

    def test_demand_greater_than_total_available_inventory(self, loc_depot, loc_demand):
        """When total demand vastly exceeds inventory, all available stock is delivered without over-delivering."""
        depot = Depot(
            id="DEPOT-LIMITED",
            location=loc_depot,
            inventory={SupplyType.WATER: 2500.0},
        )
        dp = DemandPoint(
            id="DEMAND-EXCESS",
            location=loc_demand,
            required_supplies={SupplyType.WATER: 10000.0},
            priority=Priority.CRITICAL,
        )
        route = Route(
            id="ROUTE-EXCESS",
            source=loc_depot,
            destination=loc_demand,
            distance=30.0,
            travel_time=0.6,
        )
        vehicle = Vehicle(
            id="VEH-HEAVY",
            capacity=5000.0,
            current_location=loc_depot,
            speed=50.0,
        )

        state = LogisticsState(
            vehicles={vehicle.id: vehicle},
            depots={depot.id: depot},
            demand_points={dp.id: dp},
            routes={route.id: route},
        )

        result = optimize_logistics(state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 1
        assert result.deliveries[0].quantity == 2500.0
        assert result.total_supplied == 2500.0
        assert result.total_unmet_demand == 7500.0
        assert result.inventory_used["DEPOT-LIMITED"]["water"] == 2500.0
        assert result.inventory_remaining["DEPOT-LIMITED"]["water"] == 0.0


class TestSimulationWorldOptimization:
    def test_full_simulation_world_optimization(self):
        """Execute CP-SAT on the full 3-depot, 10-vehicle, 6-demand point simulation world."""
        state = create_initial_logistics_state()
        result = optimize_logistics(state)

        assert result.status in ("OPTIMAL", "FEASIBLE")
        assert len(result.deliveries) > 0
        assert result.total_supplied > 0
        assert result.total_unmet_demand >= 0

        # Validate delivery constraints
        assigned_vehicles = set()
        depot_delivered = {d_id: {} for d_id in state.depots}
        demand_received = {dp_id: {} for dp_id in state.demand_points}

        for d in result.deliveries:
            # 1. At most one delivery per vehicle
            assert d.vehicle_id not in assigned_vehicles
            assigned_vehicles.add(d.vehicle_id)

            vehicle = state.vehicles[d.vehicle_id]
            # 2. Vehicle operational
            assert vehicle.is_operational

            # 3. Vehicle capacity
            assert d.quantity <= vehicle.capacity

            # 4. Route usable
            route = state.routes[d.route_id]
            assert route.is_usable

            # Accumulate depot & demand point supplies
            depot_delivered[d.depot_id][d.supply_type] = (
                depot_delivered[d.depot_id].get(d.supply_type, 0.0) + d.quantity
            )
            demand_received[d.demand_point_id][d.supply_type] = (
                demand_received[d.demand_point_id].get(d.supply_type, 0.0) + d.quantity
            )

        # 5. Check depot inventory limits
        for depot_id, supplies in depot_delivered.items():
            depot = state.depots[depot_id]
            for st, total_qty in supplies.items():
                assert total_qty <= depot.inventory[st]

        # 6. Check demand limits
        for dp_id, supplies in demand_received.items():
            dp = state.demand_points[dp_id]
            for st, total_qty in supplies.items():
                assert total_qty <= dp.required_supplies[st]

        # 7. Check inventory used/remaining consistency
        for depot_id, inv_map in result.inventory_used.items():
            depot = state.depots[depot_id]
            for st_val, used_qty in inv_map.items():
                st_enum = SupplyType(st_val)
                init_stock = depot.inventory.get(st_enum, 0.0)
                rem_stock = result.inventory_remaining[depot_id][st_val]
                assert round(used_qty + rem_stock, 2) == round(init_stock, 2)


class TestApiOptimizeEndpoint:
    def test_post_optimize_default_state(self):
        """POST /api/optimize without payload optimizes the simulation world state."""
        response = client.post("/api/optimize")
        assert response.status_code == 200
        data = response.json()

        validated = OptimizationResult.model_validate(data)
        assert validated.status in ("OPTIMAL", "FEASIBLE")
        assert len(validated.deliveries) > 0
        assert validated.total_supplied > 0
        assert validated.total_distance > 0
        assert validated.total_eta > 0
        assert len(validated.inventory_used) > 0
        assert len(validated.inventory_remaining) > 0

    def test_post_optimize_custom_state(self, small_deterministic_state):
        """POST /api/optimize with custom state payload executes optimization on that state."""
        payload = small_deterministic_state.model_dump(mode="json")
        response = client.post("/api/optimize", json=payload)
        assert response.status_code == 200
        data = response.json()

        validated = OptimizationResult.model_validate(data)
        assert validated.status == "OPTIMAL"
        assert len(validated.deliveries) == 1
        assert validated.deliveries[0].vehicle_id == "VEH-01"
        assert validated.deliveries[0].quantity == 200.0
        assert validated.total_supplied == 200.0
        assert validated.total_unmet_demand == 0.0


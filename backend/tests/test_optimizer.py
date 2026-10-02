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
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.models.common import Priority, RiskLevel, SupplyType
from app.models.demand_point import DemandPoint
from app.models.depot import Depot
from app.models.logistics_state import LogisticsState
from app.models.optimization import OptimizationResult, OptimizerWeights
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


class TestBlock7RouteOptimization:
    def test_normal_route_selection(self, loc_depot, loc_demand):
        """Standard route selection returns route_id, distance, travel_time, risk, and ETA."""
        depot = Depot(id="DEPOT-NORM", location=loc_depot, inventory={SupplyType.FOOD: 500.0})
        dp = DemandPoint(id="DEMAND-NORM", location=loc_demand, required_supplies={SupplyType.FOOD: 100.0})
        route = Route(
            id="ROUTE-NORM",
            source=loc_depot,
            destination=loc_demand,
            distance=42.5,
            travel_time=0.85,
            risk=RiskLevel.SAFE,
            available=True,
        )
        vehicle = Vehicle(id="VEH-NORM", capacity=300.0, current_location=loc_depot, speed=50.0)

        state = LogisticsState(
            vehicles={vehicle.id: vehicle},
            depots={depot.id: depot},
            demand_points={dp.id: dp},
            routes={route.id: route},
        )

        result = optimize_logistics(state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 1

        delivery = result.deliveries[0]
        assert delivery.route_id == "ROUTE-NORM"
        assert delivery.distance == 42.5
        assert delivery.travel_time == 0.85
        assert delivery.risk == RiskLevel.SAFE
        assert delivery.eta == 0.85

    def test_shortest_route_selection(self, loc_depot, loc_demand):
        """When multiple routes exist with equal risk, optimizer chooses the shorter/faster route."""
        depot = Depot(id="DEPOT-ROUTING", location=loc_depot, inventory={SupplyType.WATER: 500.0})
        dp = DemandPoint(id="DEMAND-ROUTING", location=loc_demand, required_supplies={SupplyType.WATER: 100.0})

        route_long = Route(
            id="ROUTE-LONG",
            source=loc_depot,
            destination=loc_demand,
            distance=95.0,
            travel_time=2.2,
            risk=RiskLevel.SAFE,
        )
        route_short = Route(
            id="ROUTE-SHORT",
            source=loc_depot,
            destination=loc_demand,
            distance=35.0,
            travel_time=0.7,
            risk=RiskLevel.SAFE,
        )
        vehicle = Vehicle(id="VEH-1", capacity=300.0, current_location=loc_depot, speed=50.0)

        state = LogisticsState(
            vehicles={vehicle.id: vehicle},
            depots={depot.id: depot},
            demand_points={dp.id: dp},
            routes={route_long.id: route_long, route_short.id: route_short},
        )

        result = optimize_logistics(state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 1
        assert result.deliveries[0].route_id == "ROUTE-SHORT"
        assert result.deliveries[0].distance == 35.0
        assert result.deliveries[0].travel_time == 0.7

    def test_risk_aware_route_selection(self, loc_depot, loc_demand):
        """Risk-averse weighting chooses longer SAFE route over shorter HIGH-risk route."""
        depot = Depot(id="DEPOT-RISK", location=loc_depot, inventory={SupplyType.MEDICINE: 200.0})
        dp = DemandPoint(id="DEMAND-RISK", location=loc_demand, required_supplies={SupplyType.MEDICINE: 50.0})

        route_short_high_risk = Route(
            id="ROUTE-SHORT-HIGH-RISK",
            source=loc_depot,
            destination=loc_demand,
            distance=20.0,
            travel_time=0.4,
            risk=RiskLevel.HIGH,
        )
        route_long_safe = Route(
            id="ROUTE-LONG-SAFE",
            source=loc_depot,
            destination=loc_demand,
            distance=50.0,
            travel_time=1.0,
            risk=RiskLevel.SAFE,
        )
        vehicle = Vehicle(id="VEH-1", capacity=200.0, current_location=loc_depot, speed=50.0)

        state = LogisticsState(
            vehicles={vehicle.id: vehicle},
            depots={depot.id: depot},
            demand_points={dp.id: dp},
            routes={
                route_short_high_risk.id: route_short_high_risk,
                route_long_safe.id: route_long_safe,
            },
        )

        # 1. Default weights: High risk penalty outweighs extra distance -> selects SAFE route
        result_default = optimize_logistics(state)
        assert result_default.status == "OPTIMAL"
        assert len(result_default.deliveries) == 1
        assert result_default.deliveries[0].route_id == "ROUTE-LONG-SAFE"
        assert result_default.deliveries[0].risk == RiskLevel.SAFE

        # 2. Configurable weights: Zero risk penalty -> selects shorter route
        weights_ignore_risk = OptimizerWeights(
            weight_risk_high=0,
            weight_risk_medium=0,
            weight_risk_low=0,
            weight_distance=10,
            weight_travel_time=100,
        )
        result_ignore_risk = optimize_logistics(state, weights=weights_ignore_risk)
        assert result_ignore_risk.status == "OPTIMAL"
        assert len(result_ignore_risk.deliveries) == 1
        assert result_ignore_risk.deliveries[0].route_id == "ROUTE-SHORT-HIGH-RISK"
        assert result_ignore_risk.deliveries[0].risk == RiskLevel.HIGH

    def test_blocked_route_cannot_be_selected(self, loc_depot, loc_demand):
        """Unavailable or blocked routes cannot be selected under any circumstances."""
        depot = Depot(id="DEPOT-BLK", location=loc_depot, inventory={SupplyType.FOOD: 300.0})
        dp = DemandPoint(id="DEMAND-BLK", location=loc_demand, required_supplies={SupplyType.FOOD: 100.0})

        route_blocked = Route(
            id="ROUTE-BLOCKED",
            source=loc_depot,
            destination=loc_demand,
            distance=15.0,
            travel_time=0.3,
            risk=RiskLevel.BLOCKED,
            available=False,
        )
        route_safe = Route(
            id="ROUTE-SAFE",
            source=loc_depot,
            destination=loc_demand,
            distance=60.0,
            travel_time=1.3,
            risk=RiskLevel.SAFE,
            available=True,
        )
        vehicle = Vehicle(id="VEH-1", capacity=300.0, current_location=loc_depot, speed=50.0)

        state = LogisticsState(
            vehicles={vehicle.id: vehicle},
            depots={depot.id: depot},
            demand_points={dp.id: dp},
            routes={route_blocked.id: route_blocked, route_safe.id: route_safe},
        )

        result = optimize_logistics(state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 1
        assert result.deliveries[0].route_id == "ROUTE-SAFE"
        assert result.deliveries[0].distance == 60.0

    def test_no_feasible_route(self, loc_depot, loc_demand):
        """When no usable route connects the depot and demand point, no deliveries are scheduled."""
        loc_unconnected = Location(lat=31.9, lon=79.9)
        depot = Depot(id="DEPOT-ISOLATED", location=loc_depot, inventory={SupplyType.FOOD: 300.0})
        dp = DemandPoint(id="DEMAND-ISOLATED", location=loc_unconnected, required_supplies={SupplyType.FOOD: 100.0})

        # Route only connects loc_depot to loc_demand (not to loc_unconnected)
        route = Route(
            id="ROUTE-OTHER",
            source=loc_depot,
            destination=loc_demand,
            distance=40.0,
            travel_time=0.8,
            risk=RiskLevel.SAFE,
        )
        vehicle = Vehicle(id="VEH-1", capacity=300.0, current_location=loc_depot, speed=50.0)

        state = LogisticsState(
            vehicles={vehicle.id: vehicle},
            depots={depot.id: depot},
            demand_points={dp.id: dp},
            routes={route.id: route},
        )

        result = optimize_logistics(state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 0
        assert result.total_supplied == 0.0
        assert result.total_unmet_demand == 100.0
        assert result.unmet_demand["DEMAND-ISOLATED"]["food"] == 100.0


# ---------------------------------------------------------------------------
# BLOCK 8: Demand Priority & Delivery Deadlines Tests
# ---------------------------------------------------------------------------

class TestBlock8PriorityAndDeadlines:
    def test_priority_hierarchy_allocation(self, loc_depot):
        """When 1 vehicle can only serve 1 of 4 competing demand points (CRITICAL, HIGH, MEDIUM, LOW),
        the optimizer strictly prioritizes the CRITICAL demand point."""
        loc_crit = Location(lat=30.1, lon=78.1)
        loc_high = Location(lat=30.2, lon=78.2)
        loc_med = Location(lat=30.3, lon=78.3)
        loc_low = Location(lat=30.4, lon=78.4)

        depot = Depot(id="DEPOT-01", location=loc_depot, inventory={SupplyType.MEDICINE: 500.0})
        vehicle = Vehicle(id="VEH-01", capacity=500.0, current_location=loc_depot, speed=50.0)

        dp_crit = DemandPoint(id="DP-CRITICAL", location=loc_crit, priority=Priority.CRITICAL, required_supplies={SupplyType.MEDICINE: 500.0})
        dp_high = DemandPoint(id="DP-HIGH", location=loc_high, priority=Priority.HIGH, required_supplies={SupplyType.MEDICINE: 500.0})
        dp_med = DemandPoint(id="DP-MED", location=loc_med, priority=Priority.MEDIUM, required_supplies={SupplyType.MEDICINE: 500.0})
        dp_low = DemandPoint(id="DP-LOW", location=loc_low, priority=Priority.LOW, required_supplies={SupplyType.MEDICINE: 500.0})

        r_crit = Route(id="R-CRIT", source=loc_depot, destination=loc_crit, distance=20.0, travel_time=0.4, risk=RiskLevel.SAFE)
        r_high = Route(id="R-HIGH", source=loc_depot, destination=loc_high, distance=20.0, travel_time=0.4, risk=RiskLevel.SAFE)
        r_med = Route(id="R-MED", source=loc_depot, destination=loc_med, distance=20.0, travel_time=0.4, risk=RiskLevel.SAFE)
        r_low = Route(id="R-LOW", source=loc_depot, destination=loc_low, distance=20.0, travel_time=0.4, risk=RiskLevel.SAFE)

        state = LogisticsState(
            vehicles={vehicle.id: vehicle},
            depots={depot.id: depot},
            demand_points={dp.id: dp for dp in [dp_crit, dp_high, dp_med, dp_low]},
            routes={r.id: r for r in [r_crit, r_high, r_med, r_low]},
        )

        result = optimize_logistics(state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 1
        delivery = result.deliveries[0]
        assert delivery.demand_point_id == "DP-CRITICAL"
        assert delivery.priority == Priority.CRITICAL
        assert delivery.quantity == 500.0
        assert result.unmet_demand["DP-CRITICAL"]["medicine"] == 0.0
        assert result.unmet_demand["DP-HIGH"]["medicine"] == 500.0
        assert result.unmet_demand["DP-MED"]["medicine"] == 500.0
        assert result.unmet_demand["DP-LOW"]["medicine"] == 500.0

    def test_high_vs_low_priority_allocation(self, loc_depot):
        """When HIGH and LOW priority demand points compete for single vehicle, HIGH receives the delivery."""
        loc_high = Location(lat=30.2, lon=78.2)
        loc_low = Location(lat=30.4, lon=78.4)

        depot = Depot(id="DEPOT-01", location=loc_depot, inventory={SupplyType.WATER: 500.0})
        vehicle = Vehicle(id="VEH-01", capacity=500.0, current_location=loc_depot, speed=50.0)

        dp_high = DemandPoint(id="DP-HIGH", location=loc_high, priority=Priority.HIGH, required_supplies={SupplyType.WATER: 500.0})
        dp_low = DemandPoint(id="DP-LOW", location=loc_low, priority=Priority.LOW, required_supplies={SupplyType.WATER: 500.0})

        r_high = Route(id="R-HIGH", source=loc_depot, destination=loc_high, distance=15.0, travel_time=0.3, risk=RiskLevel.SAFE)
        r_low = Route(id="R-LOW", source=loc_depot, destination=loc_low, distance=15.0, travel_time=0.3, risk=RiskLevel.SAFE)

        state = LogisticsState(
            vehicles={vehicle.id: vehicle},
            depots={depot.id: depot},
            demand_points={dp_high.id: dp_high, dp_low.id: dp_low},
            routes={r_high.id: r_high, r_low.id: r_low},
        )

        result = optimize_logistics(state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 1
        assert result.deliveries[0].demand_point_id == "DP-HIGH"
        assert result.deliveries[0].priority == Priority.HIGH

    def test_delivery_deadline_and_lateness_calculation(self, loc_depot):
        """Calculates expected ETA, deadline, late_delivery flag, and priority for every delivery."""
        t0 = datetime(2026, 10, 2, 12, 0, 0, tzinfo=timezone.utc)
        loc_dp1 = Location(lat=30.1, lon=78.1)
        loc_dp2 = Location(lat=30.2, lon=78.2)

        depot = Depot(id="DEPOT-01", location=loc_depot, inventory={SupplyType.FOOD: 1000.0})
        veh1 = Vehicle(id="VEH-01", capacity=500.0, current_location=loc_depot, speed=50.0)
        veh2 = Vehicle(id="VEH-02", capacity=500.0, current_location=loc_depot, speed=50.0)

        # DP-ONTIME deadline is 3h away; travel time is 1.5h -> on-time (late=False)
        dp_ontime = DemandPoint(
            id="DP-ONTIME",
            location=loc_dp1,
            priority=Priority.HIGH,
            deadline=t0 + timedelta(hours=3.0),
            required_supplies={SupplyType.FOOD: 400.0},
        )
        # DP-LATE deadline is 1h away; travel time is 2.5h -> late (late=True)
        dp_late = DemandPoint(
            id="DP-LATE",
            location=loc_dp2,
            priority=Priority.CRITICAL,
            deadline=t0 + timedelta(hours=1.0),
            required_supplies={SupplyType.FOOD: 400.0},
        )

        r1 = Route(id="R1", source=loc_depot, destination=loc_dp1, distance=75.0, travel_time=1.5, risk=RiskLevel.SAFE)
        r2 = Route(id="R2", source=loc_depot, destination=loc_dp2, distance=125.0, travel_time=2.5, risk=RiskLevel.SAFE)

        state = LogisticsState(
            vehicles={veh1.id: veh1, veh2.id: veh2},
            depots={depot.id: depot},
            demand_points={dp_ontime.id: dp_ontime, dp_late.id: dp_late},
            routes={r1.id: r1, r2.id: r2},
            timestamp=t0,
        )

        result = optimize_logistics(state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 2
        assert result.total_late_deliveries == 1

        deliv_by_dp = {d.demand_point_id: d for d in result.deliveries}
        
        d_ontime = deliv_by_dp["DP-ONTIME"]
        assert d_ontime.eta == 1.5
        assert d_ontime.deadline == dp_ontime.deadline
        assert d_ontime.late_delivery is False
        assert d_ontime.priority == Priority.HIGH

        d_late = deliv_by_dp["DP-LATE"]
        assert d_late.eta == 2.5
        assert d_late.deadline == dp_late.deadline
        assert d_late.late_delivery is True
        assert d_late.priority == Priority.CRITICAL

    def test_competing_demands_deadline_minimization(self, loc_depot):
        """When two demands of equal priority compete for 1 vehicle, solver chooses the on-time delivery to minimize lateness."""
        t0 = datetime(2026, 10, 2, 12, 0, 0, tzinfo=timezone.utc)
        loc_dp1 = Location(lat=30.1, lon=78.1)
        loc_dp2 = Location(lat=30.2, lon=78.2)

        depot = Depot(id="DEPOT-01", location=loc_depot, inventory={SupplyType.WATER: 500.0})
        vehicle = Vehicle(id="VEH-01", capacity=500.0, current_location=loc_depot, speed=50.0)

        # DP-FEASIBLE: deadline in 2.0 hours, travel time 1.0h -> can arrive on time
        dp_feasible = DemandPoint(
            id="DP-FEASIBLE",
            location=loc_dp1,
            priority=Priority.MEDIUM,
            deadline=t0 + timedelta(hours=2.0),
            required_supplies={SupplyType.WATER: 500.0},
        )
        # DP-TARDY: deadline in 0.5 hours, travel time 1.0h -> would be late
        dp_tardy = DemandPoint(
            id="DP-TARDY",
            location=loc_dp2,
            priority=Priority.MEDIUM,
            deadline=t0 + timedelta(hours=0.5),
            required_supplies={SupplyType.WATER: 500.0},
        )

        r1 = Route(id="R1", source=loc_depot, destination=loc_dp1, distance=50.0, travel_time=1.0, risk=RiskLevel.SAFE)
        r2 = Route(id="R2", source=loc_depot, destination=loc_dp2, distance=50.0, travel_time=1.0, risk=RiskLevel.SAFE)

        state = LogisticsState(
            vehicles={vehicle.id: vehicle},
            depots={depot.id: depot},
            demand_points={dp_feasible.id: dp_feasible, dp_tardy.id: dp_tardy},
            routes={r1.id: r1, r2.id: r2},
            timestamp=t0,
        )

        result = optimize_logistics(state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 1
        assert result.deliveries[0].demand_point_id == "DP-FEASIBLE"
        assert result.deliveries[0].late_delivery is False

    def test_critical_priority_preferred_even_if_late_over_low_ontime(self, loc_depot):
        """Critical urgency outweighs minor deadline tardiness penalty when priority weighting is dominant."""
        t0 = datetime(2026, 10, 2, 12, 0, 0, tzinfo=timezone.utc)
        loc_crit = Location(lat=30.1, lon=78.1)
        loc_low = Location(lat=30.2, lon=78.2)

        depot = Depot(id="DEPOT-01", location=loc_depot, inventory={SupplyType.MEDICINE: 500.0})
        vehicle = Vehicle(id="VEH-01", capacity=500.0, current_location=loc_depot, speed=50.0)

        dp_crit = DemandPoint(
            id="DP-CRITICAL",
            location=loc_crit,
            priority=Priority.CRITICAL,
            deadline=t0 + timedelta(hours=0.5),  # will be late
            required_supplies={SupplyType.MEDICINE: 500.0},
        )
        dp_low = DemandPoint(
            id="DP-LOW",
            location=loc_low,
            priority=Priority.LOW,
            deadline=t0 + timedelta(hours=5.0),  # on time
            required_supplies={SupplyType.MEDICINE: 500.0},
        )

        r_crit = Route(id="R-CRIT", source=loc_depot, destination=loc_crit, distance=50.0, travel_time=1.0, risk=RiskLevel.SAFE)
        r_low = Route(id="R-LOW", source=loc_depot, destination=loc_low, distance=50.0, travel_time=1.0, risk=RiskLevel.SAFE)

        state = LogisticsState(
            vehicles={vehicle.id: vehicle},
            depots={depot.id: depot},
            demand_points={dp_crit.id: dp_crit, dp_low.id: dp_low},
            routes={r_crit.id: r_crit, r_low.id: r_low},
            timestamp=t0,
        )

        result = optimize_logistics(state)
        assert result.status == "OPTIMAL"
        assert len(result.deliveries) == 1
        assert result.deliveries[0].demand_point_id == "DP-CRITICAL"
        assert result.deliveries[0].late_delivery is True
        assert result.deliveries[0].priority == Priority.CRITICAL


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

    def test_post_optimize_with_custom_weights(self, small_deterministic_state):
        """POST /api/optimize with custom weights and state payload."""
        payload = {
            "state": small_deterministic_state.model_dump(mode="json"),
            "weights": {
                "weight_unmet_critical": 20000,
                "weight_distance": 5,
                "weight_travel_time": 50,
                "weight_risk_high": 5000,
            },
        }
        response = client.post("/api/optimize", json=payload)
        assert response.status_code == 200
        data = response.json()

        validated = OptimizationResult.model_validate(data)
        assert validated.status == "OPTIMAL"
        assert len(validated.deliveries) == 1
        assert validated.deliveries[0].vehicle_id == "VEH-01"



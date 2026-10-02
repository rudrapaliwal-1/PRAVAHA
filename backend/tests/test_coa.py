"""
tests/test_coa.py — Unit and integration tests for Courses of Action (COA) generation.

Tests:
1. Proof that all 3 generated plans (FASTEST, LOWEST_RISK, RESOURCE_EFFICIENT) are fully feasible
   under all hard constraints (capacity, inventory, route availability, demand limits).
2. Verification of distinct strategic trade-offs across the 3 profiles:
   - FASTEST achieves lowest transit duration.
   - LOWEST_RISK avoids hazardous corridors.
   - RESOURCE_EFFICIENT minimizes travel distance/fuel consumption.
3. Post-disruption COA generation ensuring blocked assets are excluded across all 3 plans.
4. Integration test for POST /api/courses-of-action.
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.models.coa import COAType, CourseOfActionPlan, CoursesOfActionResponse
from app.models.common import Priority, RiskLevel, SupplyType
from app.models.demand_point import DemandPoint
from app.models.depot import Depot
from app.models.disruption import DisruptionRequest, DisruptionType
from app.models.logistics_state import LogisticsState
from app.models.route import Route
from app.models.vehicle import Location, Vehicle
from app.optimizer.coa_service import coa_service, generate_courses_of_action
from app.simulation.world import create_initial_logistics_state, world_state_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_world_state_before_each_test():
    world_state_service.reset_state()
    yield
    world_state_service.reset_state()


class TestCoursesOfActionGeneration:
    def test_all_three_plans_are_feasible_on_simulation_world(self):
        """All 3 generated Courses of Action on the simulation world must be strictly feasible under hard constraints."""
        state = create_initial_logistics_state()
        response = generate_courses_of_action(state=state)

        assert len(response.plans) == 3
        plan_names = {p.name for p in response.plans}
        assert plan_names == {"FASTEST", "LOWEST_RISK", "RESOURCE_EFFICIENT"}

        for plan in response.plans:
            assert plan.status in ("OPTIMAL", "FEASIBLE")
            assert len(plan.deliveries) > 0
            assert plan.eta > 0
            assert plan.distance > 0
            assert plan.cost > 0
            assert 0.0 <= plan.risk <= 1.0

            # Verify hard constraints for each plan
            assigned_vehicles = set()
            depot_used = {d_id: {} for d_id in state.depots}
            demand_received = {dp_id: {} for dp_id in state.demand_points}

            for deliv in plan.deliveries:
                # 1. At most one delivery per vehicle
                assert deliv.vehicle_id not in assigned_vehicles
                assigned_vehicles.add(deliv.vehicle_id)

                vehicle = state.vehicles[deliv.vehicle_id]
                # 2. Vehicle operational and capacity respected
                assert vehicle.is_operational
                assert deliv.quantity <= vehicle.capacity

                # 3. Route available & non-blocked
                route = state.routes[deliv.route_id]
                assert route.available is True
                assert route.risk != RiskLevel.BLOCKED
                assert route.is_usable

                # Accumulate usage
                depot_used[deliv.depot_id][deliv.supply_type] = (
                    depot_used[deliv.depot_id].get(deliv.supply_type, 0.0) + deliv.quantity
                )
                demand_received[deliv.demand_point_id][deliv.supply_type] = (
                    demand_received[deliv.demand_point_id].get(deliv.supply_type, 0.0) + deliv.quantity
                )

            # 4. Inventory limits
            for d_id, supplies in depot_used.items():
                depot = state.depots[d_id]
                for st, qty in supplies.items():
                    assert qty <= depot.inventory[st]

            # 5. Demand requirements upper bounds
            for dp_id, supplies in demand_received.items():
                dp = state.demand_points[dp_id]
                for st, qty in supplies.items():
                    assert qty <= dp.required_supplies[st]

    def test_strategic_tradeoffs_between_coas(self):
        """
        Creates an explicit decision scenario with 3 routes:
        - R_FAST:  dist=80km, time=0.8h, risk=HIGH (Fastest)
        - R_SAFE:  dist=70km, time=1.4h, risk=SAFE (Lowest Risk)
        - R_SHORT: dist=30km, time=1.8h, risk=LOW  (Resource Efficient / Shortest)
        """
        loc_depot = Location(lat=30.0, lon=78.0)
        loc_demand = Location(lat=30.2, lon=78.2)

        depot = Depot(id="DEPOT-01", location=loc_depot, inventory={SupplyType.MEDICINE: 500.0})
        dp = DemandPoint(id="DEMAND-01", location=loc_demand, required_supplies={SupplyType.MEDICINE: 500.0})
        vehicle = Vehicle(id="VEH-01", capacity=500.0, current_location=loc_depot, speed=50.0)

        r_fast = Route(id="R-FAST", source=loc_depot, destination=loc_demand, distance=80.0, travel_time=0.8, risk=RiskLevel.HIGH)
        r_safe = Route(id="R-SAFE", source=loc_depot, destination=loc_demand, distance=70.0, travel_time=1.4, risk=RiskLevel.SAFE)
        r_short = Route(id="R-SHORT", source=loc_depot, destination=loc_demand, distance=30.0, travel_time=1.8, risk=RiskLevel.LOW)

        state = LogisticsState(
            vehicles={vehicle.id: vehicle},
            depots={depot.id: depot},
            demand_points={dp.id: dp},
            routes={r_fast.id: r_fast, r_safe.id: r_safe, r_short.id: r_short},
        )

        response = generate_courses_of_action(state=state)
        plans_by_name = {p.name: p for p in response.plans}

        plan_fastest = plans_by_name["FASTEST"]
        plan_lowest_risk = plans_by_name["LOWEST_RISK"]
        plan_resource_efficient = plans_by_name["RESOURCE_EFFICIENT"]

        # FASTEST selects R-FAST (0.8h)
        assert plan_fastest.deliveries[0].route_id == "R-FAST"
        assert plan_fastest.eta == 0.8

        # LOWEST_RISK selects R-SAFE (SAFE risk = 0.0)
        assert plan_lowest_risk.deliveries[0].route_id == "R-SAFE"
        assert plan_lowest_risk.risk == 0.0

        # RESOURCE_EFFICIENT selects R-SHORT (30km)
        assert plan_resource_efficient.deliveries[0].route_id == "R-SHORT"
        assert plan_resource_efficient.distance == 30.0

    def test_post_disruption_coa_generation(self):
        """Disruption applied prior to COA generation ensures blocked corridors are excluded from all 3 plans."""
        state = create_initial_logistics_state()
        disruption = DisruptionRequest(type=DisruptionType.BLOCK_ROUTE, target_id="ROUTE-01")

        response = generate_courses_of_action(state=state, disruption=disruption)

        for plan in response.plans:
            assert plan.status in ("OPTIMAL", "FEASIBLE")
            assert all(d.route_id != "ROUTE-01" for d in plan.deliveries)


class TestApiCoursesOfActionEndpoint:
    def test_post_courses_of_action_endpoint(self):
        """POST /api/courses-of-action returns 200 OK and conforms to CoursesOfActionResponse schema."""
        response = client.post("/api/courses-of-action", json={})
        assert response.status_code == 200
        data = response.json()

        validated = CoursesOfActionResponse.model_validate(data)
        assert len(validated.plans) == 3
        for plan in validated.plans:
            assert plan.name in ("FASTEST", "LOWEST_RISK", "RESOURCE_EFFICIENT")
            assert plan.eta >= 0.0
            assert plan.distance >= 0.0
            assert 0.0 <= plan.risk <= 1.0
            assert plan.cost >= 0.0
            assert plan.unmet_demand >= 0.0
            assert len(plan.deliveries) > 0

"""
tests/test_reoptimizer.py — Unit and integration tests for Dynamic Re-Optimization.

Integration Test Workflow:
1. Generate normal baseline logistics plan with CP-SAT.
2. Block a route actively utilized by that plan.
3. Run dynamic re-optimization.
4. Verify that the blocked route is NOT used in the new plan.
5. Verify that an alternative feasible route is selected.
6. Verify comparative delta metrics: delay, affected deliveries, ETAs, and solver status.
7. Test vehicle failure re-optimization and POST /api/reoptimize API endpoint.
"""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.models.common import Priority, RiskLevel, SupplyType
from app.models.demand_point import DemandPoint
from app.models.depot import Depot
from app.models.disruption import DisruptionRequest, DisruptionType
from app.models.logistics_state import LogisticsState
from app.models.reoptimization import ReoptimizationResult
from app.models.route import Route
from app.models.vehicle import Location, Vehicle
from app.optimizer.reoptimizer import reoptimize_logistics, reoptimizer_service
from app.optimizer.service import optimize_logistics
from app.simulation.world import create_initial_logistics_state, world_state_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_world_state_before_each_test():
    world_state_service.reset_state()
    yield
    world_state_service.reset_state()


class TestDynamicReoptimizer:
    def test_block_route_reoptimization_selects_alternative(self):
        """
        Required Integration Test:
        1. Generate normal plan.
        2. Block a route used by that plan.
        3. Run re-optimization.
        4. Verify that the blocked route is not used.
        5. Verify that another feasible route is selected if available.
        """
        loc_depot = Location(lat=30.0, lon=78.0)
        loc_demand = Location(lat=30.2, lon=78.2)

        depot = Depot(id="DEPOT-01", location=loc_depot, inventory={SupplyType.FOOD: 1000.0})
        dp = DemandPoint(id="DEMAND-01", location=loc_demand, required_supplies={SupplyType.FOOD: 500.0}, priority=Priority.HIGH)
        vehicle = Vehicle(id="VEH-01", capacity=500.0, current_location=loc_depot, speed=50.0)

        # Primary fast route (20km, 0.4h) vs Secondary alternative route (40km, 0.8h)
        route_fast = Route(
            id="ROUTE-FAST",
            source=loc_depot,
            destination=loc_demand,
            distance=20.0,
            travel_time=0.4,
            risk=RiskLevel.SAFE,
            available=True,
        )
        route_alt = Route(
            id="ROUTE-ALT",
            source=loc_depot,
            destination=loc_demand,
            distance=40.0,
            travel_time=0.8,
            risk=RiskLevel.SAFE,
            available=True,
        )

        state = LogisticsState(
            vehicles={vehicle.id: vehicle},
            depots={depot.id: depot},
            demand_points={dp.id: dp},
            routes={route_fast.id: route_fast, route_alt.id: route_alt},
        )

        # Step 1: Baseline plan selects the faster route
        baseline = optimize_logistics(state)
        assert baseline.status == "OPTIMAL"
        assert len(baseline.deliveries) == 1
        assert baseline.deliveries[0].route_id == "ROUTE-FAST"
        assert baseline.total_eta == 0.4

        # Step 2 & 3: Block ROUTE-FAST and trigger re-optimization
        disruption = DisruptionRequest(
            type=DisruptionType.BLOCK_ROUTE,
            target_id="ROUTE-FAST",
        )
        result = reoptimize_logistics(disruption=disruption, state=state, previous_plan=baseline)

        # Step 4: Verify blocked route is not used
        assert all(d.route_id != "ROUTE-FAST" for d in result.new_plan.deliveries)
        assert state.routes["ROUTE-FAST"].available is False
        assert state.routes["ROUTE-FAST"].risk == RiskLevel.BLOCKED

        # Verify affected deliveries includes the initial delivery
        assert len(result.affected_deliveries) == 1
        assert result.affected_deliveries[0].route_id == "ROUTE-FAST"
        assert "ROUTE-FAST" in result.affected_routes

        # Step 5: Verify alternative feasible route is selected
        assert result.optimization_status == "OPTIMAL"
        assert len(result.new_plan.deliveries) == 1
        new_delivery = result.new_plan.deliveries[0]
        assert new_delivery.route_id == "ROUTE-ALT"
        assert new_delivery.distance == 40.0
        assert new_delivery.eta == 0.8
        assert new_delivery.quantity == 500.0

        # Step 6: Verify comparative metrics & delay
        assert result.previous_eta == 0.4
        assert result.new_eta == 0.8
        assert result.delay == 0.4
        assert result.unmet_demand["DEMAND-01"]["food"] == 0.0

    def test_vehicle_failure_reoptimization_reassigns_to_available_fleet(self):
        """When an assigned vehicle breaks down, re-optimization dispatches a standby vehicle."""
        loc_depot = Location(lat=30.0, lon=78.0)
        loc_demand = Location(lat=30.2, lon=78.2)

        depot = Depot(id="DEPOT-01", location=loc_depot, inventory={SupplyType.MEDICINE: 500.0})
        dp = DemandPoint(id="DEMAND-01", location=loc_demand, required_supplies={SupplyType.MEDICINE: 300.0})
        
        # Primary vehicle and standby backup vehicle
        veh_primary = Vehicle(id="VEH-PRIMARY", capacity=500.0, current_location=loc_depot, speed=50.0)
        veh_standby = Vehicle(id="VEH-STANDBY", capacity=500.0, current_location=loc_depot, speed=50.0)

        route = Route(id="ROUTE-01", source=loc_depot, destination=loc_demand, distance=25.0, travel_time=0.5, risk=RiskLevel.SAFE)

        state = LogisticsState(
            vehicles={veh_primary.id: veh_primary, veh_standby.id: veh_standby},
            depots={depot.id: depot},
            demand_points={dp.id: dp},
            routes={route.id: route},
        )

        # Baseline plan
        baseline = optimize_logistics(state)
        assigned_veh = baseline.deliveries[0].vehicle_id

        # Break the assigned vehicle
        disruption = DisruptionRequest(type=DisruptionType.VEHICLE_FAILURE, target_id=assigned_veh)
        result = reoptimize_logistics(disruption=disruption, state=state, previous_plan=baseline)

        assert result.optimization_status == "OPTIMAL"
        assert len(result.new_plan.deliveries) == 1
        assert result.new_plan.deliveries[0].vehicle_id != assigned_veh
        assert result.affected_vehicles == [assigned_veh]
        assert len(result.affected_deliveries) == 1

    def test_simulation_world_disruption_reoptimization(self):
        """Re-optimizes the full simulated world state when a key bridge/route is blocked."""
        state = create_initial_logistics_state()
        baseline = optimize_logistics(state)
        assert len(baseline.deliveries) > 0

        # Choose an actively used route from the baseline plan
        active_route_id = baseline.deliveries[0].route_id

        disruption = DisruptionRequest(type=DisruptionType.BLOCK_ROUTE, target_id=active_route_id)
        result = reoptimize_logistics(disruption=disruption, state=state, previous_plan=baseline)

        assert result.optimization_status in ("OPTIMAL", "FEASIBLE")
        # Ensure active_route_id is not in new plan
        assert all(d.route_id != active_route_id for d in result.new_plan.deliveries)
        assert active_route_id in result.affected_routes


class TestApiReoptimizeEndpoint:
    def test_post_reoptimize_api(self):
        """POST /api/reoptimize returns valid ReoptimizationResult schema."""
        payload = {
            "disruption": {
                "type": "BLOCK_ROUTE",
                "target_id": "ROUTE-03",
            }
        }
        response = client.post("/api/reoptimize", json=payload)
        assert response.status_code == 200
        data = response.json()

        validated = ReoptimizationResult.model_validate(data)
        assert "BLOCK_ROUTE" in validated.trigger
        assert validated.optimization_status in ("OPTIMAL", "FEASIBLE")
        assert validated.new_plan.total_supplied >= 0
        assert validated.previous_plan.total_supplied >= 0

"""
resilience/service.py — Supply Chain Resilience Assessment Engine.

Computes a holistic 0-100 resilience score across 5 key dimensions:
1. Inventory Availability (depot stock vs aggregate demand)
2. Fleet Availability (operational vehicles & fuel levels)
3. Route Availability (navigable network corridors & risk profile)
4. Demand Coverage (scheduled deliveries vs required demand)
5. Connectivity (topological graph reachability between depots & demand points)
"""

from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

from app.models.common import Priority, RiskLevel, SupplyType
from app.models.logistics_state import LogisticsState
from app.models.resilience import ResilienceScore


class ResilienceScoringEngine:
    """
    Evaluates multi-dimensional supply chain resilience health scores.
    """

    def calculate_resilience(
        self,
        state: LogisticsState,
    ) -> ResilienceScore:
        """
        Calculates resilience metrics from the current LogisticsState.

        Args:
            state: Active LogisticsState snapshot.

        Returns:
            ResilienceScore containing overall score, sub-scores, and key factors.
        """
        now = datetime.now(timezone.utc)

        # ---------------------------------------------------------------------
        # 1. INVENTORY AVAILABILITY SCORE (0 - 100)
        # ---------------------------------------------------------------------
        supply_ratios: List[float] = []
        all_supply_types = set()
        for dp in state.demand_points.values():
            all_supply_types.update(dp.required_supplies.keys())

        if not all_supply_types:
            all_supply_types = {SupplyType.MEDICAL, SupplyType.WATER, SupplyType.FOOD, SupplyType.FUEL, SupplyType.EQUIPMENT}

        for st in all_supply_types:
            total_stock = sum(d.inventory.get(st, 0.0) for d in state.depots.values())
            total_demand = sum(dp.required_supplies.get(st, 0.0) for dp in state.demand_points.values())
            if total_demand <= 0.0:
                supply_ratios.append(1.0 if total_stock > 0 else 0.5)
            else:
                # Safe operational buffer ratio (requires at least 10x immediate demand for full sustainment score)
                buffer_target = total_demand * 10.0
                ratio = min(1.0, total_stock / max(1.0, buffer_target))
                supply_ratios.append(ratio)

        depot_healths: List[float] = []
        for d in state.depots.values():
            depot_total = sum(d.inventory.values())
            depot_healths.append(min(1.0, depot_total / 20000.0))

        avg_depot_health = sum(depot_healths) / len(depot_healths) if depot_healths else 1.0
        avg_supply_ratio = sum(supply_ratios) / len(supply_ratios) if supply_ratios else 1.0

        inventory_score = round(
            ((avg_supply_ratio * 0.60) + (avg_depot_health * 0.40)) * 100.0,
            1,
        )

        # ---------------------------------------------------------------------
        # 2. FLEET AVAILABILITY SCORE (0 - 100)
        # ---------------------------------------------------------------------
        if not state.vehicles:
            fleet_score = 0.0
        else:
            vehicle_healths: List[float] = []
            for v in state.vehicles.values():
                if not v.is_operational or not v.available:
                    vehicle_healths.append(0.0)
                else:
                    fuel_factor = min(1.0, max(0.0, v.fuel_level / 100.0))
                    # Weight operational readiness 70%, fuel 30%
                    health = 0.70 + (0.30 * fuel_factor)
                    vehicle_healths.append(health)

            fleet_score = round(
                (sum(vehicle_healths) / len(state.vehicles)) * 100.0,
                1,
            )

        # ---------------------------------------------------------------------
        # 3. ROUTE AVAILABILITY SCORE (0 - 100)
        # ---------------------------------------------------------------------
        if not state.routes:
            route_score = 0.0
        else:
            risk_weights = {
                RiskLevel.SAFE: 1.0,
                RiskLevel.LOW: 0.85,
                RiskLevel.MEDIUM: 0.65,
                RiskLevel.HIGH: 0.35,
                RiskLevel.BLOCKED: 0.0,
            }
            route_healths: List[float] = []
            for r in state.routes.values():
                if not r.available or not r.is_usable or r.risk == RiskLevel.BLOCKED:
                    route_healths.append(0.0)
                else:
                    route_healths.append(risk_weights.get(r.risk, 0.5))

            route_score = round(
                (sum(route_healths) / len(state.routes)) * 100.0,
                1,
            )

        # ---------------------------------------------------------------------
        # 4. DEMAND COVERAGE SCORE (0 - 100)
        # ---------------------------------------------------------------------
        total_demand_needed = sum(dp.total_required() for dp in state.demand_points.values())
        if total_demand_needed <= 0.0:
            demand_coverage_score = 100.0
        else:
            # Check scheduled/active deliveries in state
            active_supplied = sum(d.quantity for d in state.deliveries if d.is_active)
            if active_supplied > 0.0:
                demand_coverage_score = round(
                    min(100.0, (active_supplied / total_demand_needed) * 100.0),
                    1,
                )
            else:
                # Baseline deliverable capacity estimation based on operational fleet vs reachable demand
                operational_capacity = sum(v.capacity for v in state.vehicles.values() if v.is_operational)
                coverage_ratio = min(1.0, operational_capacity / max(1.0, total_demand_needed))
                # Base potential coverage weighted by fleet and route availability
                demand_coverage_score = round(
                    coverage_ratio * 0.5 * ((fleet_score + route_score) / 2.0),
                    1,
                )

        # ---------------------------------------------------------------------
        # 5. CONNECTIVITY SCORE (0 - 100)
        # ---------------------------------------------------------------------
        if not state.demand_points or not state.depots:
            connectivity_score = 100.0 if not state.demand_points else 0.0
        else:
            reachable_dps: Set[str] = set()
            redundant_dps: Set[str] = set()

            for dp_id, dp in state.demand_points.items():
                usable_routes_count = 0
                p_loc = dp.location

                for d_id, depot in state.depots.items():
                    d_loc = depot.location
                    for route in state.routes.values():
                        if not route.is_usable:
                            continue
                        if (
                            abs(route.source.lat - d_loc.lat) < 1e-4
                            and abs(route.source.lon - d_loc.lon) < 1e-4
                            and abs(route.destination.lat - p_loc.lat) < 1e-4
                            and abs(route.destination.lon - p_loc.lon) < 1e-4
                        ):
                            usable_routes_count += 1

                if usable_routes_count >= 1:
                    reachable_dps.add(dp_id)
                if usable_routes_count >= 2:
                    redundant_dps.add(dp_id)

            total_dp_count = len(state.demand_points)
            base_reachability = len(reachable_dps) / total_dp_count
            redundancy_bonus = (len(redundant_dps) / total_dp_count) * 0.15
            connectivity_score = round(min(100.0, (base_reachability * 85.0) + (redundancy_bonus * 100.0)), 1)

        # ---------------------------------------------------------------------
        # 6. OVERALL RESILIENCE SCORE (0 - 100)
        # ---------------------------------------------------------------------
        overall = round(
            (inventory_score * 0.25)
            + (fleet_score * 0.20)
            + (route_score * 0.20)
            + (demand_coverage_score * 0.20)
            + (connectivity_score * 0.15),
            1,
        )
        overall_clamped = min(100.0, max(0.0, overall))

        # ---------------------------------------------------------------------
        # 7. IDENTIFY KEY FACTORS
        # ---------------------------------------------------------------------
        key_factors: List[str] = []

        if route_score < 70.0:
            key_factors.append("Route availability decreased due to corridor blockages or high risk")
        elif route_score >= 85.0:
            key_factors.append("Route infrastructure robust with high corridor availability")

        if fleet_score < 75.0:
            key_factors.append("Fleet capacity reduced by vehicle downtime or fuel depletion")
        elif fleet_score >= 85.0:
            key_factors.append("Fleet operational readiness optimal across transport vehicles")

        if inventory_score < 80.0:
            key_factors.append("Depot stock reserves constrained relative to regional demand")
        elif inventory_score >= 95.0:
            key_factors.append("Depot inventories fully stocked across all critical supply types")

        if connectivity_score < 80.0:
            key_factors.append("Network connectivity degraded; certain demand points isolated")

        if demand_coverage_score >= 70.0:
            key_factors.append("Demand coverage improved with active scheduled deliveries")
        elif demand_coverage_score < 40.0:
            key_factors.append("Demand coverage pending dispatch optimization")

        if not key_factors:
            key_factors.append("Network operations stable with balanced resilience indices")

        return ResilienceScore(
            overall_score=overall_clamped,
            inventory=inventory_score,
            fleet=fleet_score,
            routes=route_score,
            demand_coverage=demand_coverage_score,
            connectivity=connectivity_score,
            key_factors=key_factors,
            calculated_at=now,
        )


# Singleton resilience engine instance
resilience_engine = ResilienceScoringEngine()


def calculate_resilience(state: LogisticsState) -> ResilienceScore:
    """Helper function to calculate resilience score."""
    return resilience_engine.calculate_resilience(state)

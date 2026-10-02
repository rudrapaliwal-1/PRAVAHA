"""
simulation/disruption_service.py — Disruption Simulation Engine for MissionPath.

Injects operational disruptions (route blockage, vehicle breakdown, demand surge,
inventory loss, new emergencies) into the simulation state and tracks state mutations.
"""

from datetime import datetime, timezone
import math
from typing import Dict, List, Optional
import uuid

from app.models.common import Priority, RiskLevel, SupplyType
from app.models.demand_point import DemandPoint
from app.models.disruption import DisruptionRequest, DisruptionResult, DisruptionType
from app.models.logistics_state import LogisticsState
from app.models.route import Route
from app.models.vehicle import Location


def _find_entity_key(collection: Dict[str, any], target_id: str) -> Optional[str]:
    """
    Finds key in a collection supporting exact match or relaxed ID matching (e.g. 'R04' vs 'ROUTE-04').
    """
    if target_id in collection:
        return target_id

    # Normalized lookup
    target_clean = target_id.replace("-", "").replace("_", "").lower()
    for key in collection.keys():
        key_clean = key.replace("-", "").replace("_", "").lower()
        if target_clean == key_clean:
            return key
        # Handle cases like "R04" matching "ROUTE04" or "ROUTE4"
        if target_clean.replace("route", "r") == key_clean.replace("route", "r"):
            return key
        if target_clean.replace("veh", "v") == key_clean.replace("veh", "v"):
            return key
        if target_clean.replace("demand", "dp") == key_clean.replace("demand", "dp"):
            return key
    return None


class DisruptionSimulationEngine:
    """
    Simulation engine responsible for executing operational disruption events.
    """

    def apply_disruption(
        self,
        state: LogisticsState,
        request: DisruptionRequest,
    ) -> DisruptionResult:
        """
        Applies the requested disruption event to the target LogisticsState.

        Args:
            state: The LogisticsState to modify.
            request: DisruptionRequest specifying the disruption type, target entity, and parameters.

        Returns:
            DisruptionResult containing event ID, affected entities, and detailed state changes.
        """
        now = datetime.now(timezone.utc)
        event_id = f"DISRUPT-{uuid.uuid4().hex[:8].upper()}"
        d_type = request.type
        params = request.parameters or {}

        if d_type == DisruptionType.BLOCK_ROUTE:
            if not request.target_id:
                raise ValueError("target_id is required for BLOCK_ROUTE disruption")

            matched_key = _find_entity_key(state.routes, request.target_id)
            if not matched_key:
                raise ValueError(f"Route '{request.target_id}' not found in active state")

            route = state.routes[matched_key]
            prev_available = route.available
            prev_risk = route.risk.value

            route.available = False
            route.risk = RiskLevel.BLOCKED

            return DisruptionResult(
                event_id=event_id,
                event_type=d_type,
                affected_entities=[route.id],
                state_changes={
                    "route_id": route.id,
                    "previous_available": prev_available,
                    "new_available": False,
                    "previous_risk": prev_risk,
                    "new_risk": RiskLevel.BLOCKED.value,
                },
                timestamp=now,
            )

        elif d_type == DisruptionType.VEHICLE_FAILURE:
            if not request.target_id:
                raise ValueError("target_id is required for VEHICLE_FAILURE disruption")

            matched_key = _find_entity_key(state.vehicles, request.target_id)
            if not matched_key:
                raise ValueError(f"Vehicle '{request.target_id}' not found in active fleet")

            vehicle = state.vehicles[matched_key]
            prev_available = vehicle.available

            vehicle.available = False

            return DisruptionResult(
                event_id=event_id,
                event_type=d_type,
                affected_entities=[vehicle.id],
                state_changes={
                    "vehicle_id": vehicle.id,
                    "previous_available": prev_available,
                    "new_available": False,
                },
                timestamp=now,
            )

        elif d_type == DisruptionType.DEMAND_SURGE:
            if not request.target_id:
                raise ValueError("target_id is required for DEMAND_SURGE disruption")

            matched_key = _find_entity_key(state.demand_points, request.target_id)
            if not matched_key:
                raise ValueError(f"Demand point '{request.target_id}' not found in active state")

            dp = state.demand_points[matched_key]
            multiplier = float(params.get("multiplier", params.get("surge_multiplier", 1.5)))
            specific_supply = params.get("supply_type")
            additional_quantity = params.get("additional_quantity")

            prev_supplies = {st.value: qty for st, qty in dp.required_supplies.items()}
            new_supplies = dict(dp.required_supplies)

            if specific_supply is not None:
                st_enum = SupplyType(specific_supply)
                curr = new_supplies.get(st_enum, 0.0)
                if additional_quantity is not None:
                    new_supplies[st_enum] = round(curr + float(additional_quantity), 2)
                else:
                    new_supplies[st_enum] = round(curr * multiplier, 2)
            else:
                for st, qty in new_supplies.items():
                    if additional_quantity is not None:
                        new_supplies[st] = round(qty + float(additional_quantity), 2)
                    else:
                        new_supplies[st] = round(qty * multiplier, 2)

            dp.required_supplies = new_supplies

            return DisruptionResult(
                event_id=event_id,
                event_type=d_type,
                affected_entities=[dp.id],
                state_changes={
                    "demand_point_id": dp.id,
                    "surge_multiplier": multiplier if specific_supply is None and additional_quantity is None else None,
                    "previous_required_supplies": prev_supplies,
                    "new_required_supplies": {st.value: q for st, q in new_supplies.items()},
                },
                timestamp=now,
            )

        elif d_type == DisruptionType.INVENTORY_SHORTAGE:
            if not request.target_id:
                raise ValueError("target_id is required for INVENTORY_SHORTAGE disruption")

            matched_key = _find_entity_key(state.depots, request.target_id)
            if not matched_key:
                raise ValueError(f"Depot '{request.target_id}' not found in active state")

            depot = state.depots[matched_key]
            prev_inv = {st.value: qty for st, qty in depot.inventory.items()}
            new_inv = dict(depot.inventory)

            loss_fraction = float(params.get("loss_fraction", params.get("reduction_percentage", 0.5)))
            specific_supply = params.get("supply_type")
            reduction_amount = params.get("reduction_amount")

            if specific_supply is not None:
                st_enum = SupplyType(specific_supply)
                curr = new_inv.get(st_enum, 0.0)
                if reduction_amount is not None:
                    new_inv[st_enum] = round(max(0.0, curr - float(reduction_amount)), 2)
                else:
                    new_inv[st_enum] = round(max(0.0, curr * (1.0 - loss_fraction)), 2)
            else:
                for st, qty in new_inv.items():
                    if reduction_amount is not None:
                        new_inv[st] = round(max(0.0, qty - float(reduction_amount)), 2)
                    else:
                        new_inv[st] = round(max(0.0, qty * (1.0 - loss_fraction)), 2)

            depot.inventory = new_inv

            return DisruptionResult(
                event_id=event_id,
                event_type=d_type,
                affected_entities=[depot.id],
                state_changes={
                    "depot_id": depot.id,
                    "previous_inventory": prev_inv,
                    "new_inventory": {st.value: q for st, q in new_inv.items()},
                },
                timestamp=now,
            )

        elif d_type == DisruptionType.NEW_EMERGENCY:
            new_id = str(params.get("id") or request.target_id or f"DEMAND-EMERGENCY-{uuid.uuid4().hex[:4].upper()}")
            loc_data = params.get("location", {"lat": 30.4500, "lon": 78.3500})
            if isinstance(loc_data, dict):
                loc = Location(lat=loc_data["lat"], lon=loc_data["lon"])
            else:
                loc = loc_data

            req_supplies_raw = params.get("required_supplies", {
                SupplyType.MEDICINE: 1200.0,
                SupplyType.WATER: 4000.0,
                SupplyType.FOOD: 2500.0,
            })
            req_supplies = {
                SupplyType(k) if isinstance(k, str) else k: float(v)
                for k, v in req_supplies_raw.items()
            }

            consumption_raw = params.get("consumption_rate", {
                SupplyType.MEDICINE: 50.0,
                SupplyType.WATER: 120.0,
                SupplyType.FOOD: 80.0,
            })
            consumption_rates = {
                SupplyType(k) if isinstance(k, str) else k: float(v)
                for k, v in consumption_raw.items()
            }

            p_val = params.get("priority", Priority.CRITICAL)
            priority = Priority(p_val) if isinstance(p_val, str) else p_val

            new_dp = DemandPoint(
                id=new_id,
                location=loc,
                required_supplies=req_supplies,
                priority=priority,
                deadline=params.get("deadline"),
                consumption_rate=consumption_rates,
            )

            state.demand_points[new_id] = new_dp
            created_routes: List[str] = []

            # Automatically establish connecting routes from all depots so the new emergency is serviceable
            for d_id, depot in state.depots.items():
                r_id = f"ROUTE-EMERGENCY-{depot.id}-{new_id}"
                # Haversine approximation for distance
                dlat = (new_dp.location.lat - depot.location.lat) * 111.0
                dlon = (new_dp.location.lon - depot.location.lon) * 96.0
                dist = round(math.sqrt(dlat**2 + dlon**2) + 10.0, 1)
                tt = round(dist / 45.0, 2)

                new_route = Route(
                    id=r_id,
                    source=depot.location,
                    destination=new_dp.location,
                    distance=dist,
                    travel_time=tt,
                    risk=RiskLevel.MEDIUM,
                    available=True,
                )
                state.routes[r_id] = new_route
                created_routes.append(r_id)

            return DisruptionResult(
                event_id=event_id,
                event_type=d_type,
                affected_entities=[new_id] + created_routes,
                state_changes={
                    "new_demand_point": new_dp.model_dump(mode="json"),
                    "created_routes": created_routes,
                },
                timestamp=now,
            )

        else:
            raise ValueError(f"Unsupported disruption type '{d_type}'")


# Singleton disruption simulation engine
disruption_engine = DisruptionSimulationEngine()


def simulate_disruption(
    state: LogisticsState,
    request: DisruptionRequest,
) -> DisruptionResult:
    """Helper function to execute a disruption event on a logistics state."""
    return disruption_engine.apply_disruption(state, request)

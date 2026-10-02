"""
optimizer/service.py — Google OR-Tools CP-SAT Logistics Optimizer.

Solves the single-delivery vehicle routing and allocation problem for disaster relief
and military logistics under strict capacity, inventory, and route availability constraints.
"""

from typing import Dict, List, Optional, Tuple
from ortools.sat.python import cp_model

from app.models.common import Priority, SupplyType
from app.models.demand_point import DemandPoint
from app.models.depot import Depot
from app.models.logistics_state import LogisticsState
from app.models.optimization import OptimizationDelivery, OptimizationResult
from app.models.route import Route
from app.models.vehicle import Vehicle


# Scaling factor for continuous/floating-point quantities in CP-SAT integer domains
QTY_SCALE = 100

# Priority weights for unmet demand penalty
PRIORITY_WEIGHTS = {
    Priority.CRITICAL: 10_000,
    Priority.HIGH: 5_000,
    Priority.MEDIUM: 2_000,
    Priority.LOW: 1_000,
}


def _find_usable_connecting_routes(
    depot: Depot,
    demand_point: DemandPoint,
    routes: Dict[str, Route],
) -> List[Route]:
    """Finds all available, non-blocked routes connecting depot to demand point."""
    matching: List[Route] = []
    d_loc = depot.location
    p_loc = demand_point.location

    for route in routes.values():
        if not route.is_usable:
            continue
        if (
            abs(route.source.lat - d_loc.lat) < 1e-4
            and abs(route.source.lon - d_loc.lon) < 1e-4
            and abs(route.destination.lat - p_loc.lat) < 1e-4
            and abs(route.destination.lon - p_loc.lon) < 1e-4
        ):
            matching.append(route)
    return matching


class LogisticsOptimizerService:
    """
    CP-SAT Optimization service for logistics network dispatching.
    Encapsulates problem compilation, solving, and response formatting.
    """

    def optimize(self, state: LogisticsState) -> OptimizationResult:
        """
        Executes CP-SAT optimization on the given LogisticsState.

        Returns:
            OptimizationResult containing status, objective_value, deliveries, unmet_demand,
            total_distance, and total_eta.
        """
        model = cp_model.CpModel()

        # 1. Filter operational vehicles & candidate nodes
        operational_vehicles = [v for v in state.vehicles.values() if v.is_operational]
        depots = state.depots
        demand_points = state.demand_points
        routes = state.routes

        # Build initial unmet demand and inventory structures in case of trivial or infeasible state
        initial_unmet: Dict[str, Dict[str, float]] = {}
        for dp_id, dp in demand_points.items():
            initial_unmet[dp_id] = {st.value: float(qty) for st, qty in dp.required_supplies.items() if qty > 0}

        initial_inv_used: Dict[str, Dict[str, float]] = {
            d_id: {st.value: 0.0 for st in d.inventory}
            for d_id, d in depots.items()
        }
        initial_inv_rem: Dict[str, Dict[str, float]] = {
            d_id: {st.value: float(qty) for st, qty in d.inventory.items()}
            for d_id, d in depots.items()
        }
        total_initial_unmet = round(sum(sum(dp_u.values()) for dp_u in initial_unmet.values()), 2)

        # If no operational vehicles or no demand, return baseline immediately
        if not operational_vehicles or not demand_points or not depots:
            return OptimizationResult(
                status="OPTIMAL",
                objective_value=0.0,
                deliveries=[],
                unmet_demand=initial_unmet,
                total_supplied=0.0,
                total_unmet_demand=total_initial_unmet,
                inventory_used=initial_inv_used,
                inventory_remaining=initial_inv_rem,
                total_distance=0.0,
                total_eta=0.0,
            )

        # 2. Build candidate assignment tuples (v, d, p, s, r)
        # Tuple definition: (v_id, d_id, p_id, supply_type, r_id, max_qty_int, distance, eta, route_risk)
        Candidate = Tuple[Vehicle, Depot, DemandPoint, SupplyType, Route, int]
        candidates: List[Candidate] = []

        for d in depots.values():
            for p in demand_points.values():
                connecting_routes = _find_usable_connecting_routes(d, p, routes)
                if not connecting_routes:
                    continue

                for st, required_qty in p.required_supplies.items():
                    if required_qty <= 0:
                        continue
                    available_inventory = d.inventory.get(st, 0.0)
                    if available_inventory <= 0:
                        continue

                    for v in operational_vehicles:
                        max_possible_qty = min(v.capacity, available_inventory, required_qty)
                        if max_possible_qty <= 0:
                            continue

                        max_qty_int = int(round(max_possible_qty * QTY_SCALE))
                        if max_qty_int <= 0:
                            continue

                        for r in connecting_routes:
                            candidates.append((v, d, p, st, r, max_qty_int))

        if not candidates:
            return OptimizationResult(
                status="OPTIMAL",
                objective_value=0.0,
                deliveries=[],
                unmet_demand=initial_unmet,
                total_supplied=0.0,
                total_unmet_demand=total_initial_unmet,
                inventory_used=initial_inv_used,
                inventory_remaining=initial_inv_rem,
                total_distance=0.0,
                total_eta=0.0,
            )

        # 3. Create CP-SAT decision variables
        # x_vars[idx] -> bool: whether delivery candidate idx is executed
        # q_vars[idx] -> int: delivered quantity for candidate idx
        x_vars = {}
        q_vars = {}

        for idx, (v, d, p, st, r, max_qty_int) in enumerate(candidates):
            x_var = model.NewBoolVar(f"x_{idx}_{v.id}_{d.id}_{p.id}_{st.value}_{r.id}")
            q_var = model.NewIntVar(0, max_qty_int, f"q_{idx}_{v.id}_{d.id}_{p.id}_{st.value}_{r.id}")

            # Link x_var and q_var
            model.Add(q_var >= 1).OnlyEnforceIf(x_var)
            model.Add(q_var == 0).OnlyEnforceIf(x_var.Not())
            model.Add(q_var <= int(round(v.capacity * QTY_SCALE))).OnlyEnforceIf(x_var)

            x_vars[idx] = x_var
            q_vars[idx] = q_var

        # 4. HARD CONSTRAINTS

        # Constraint 1: A vehicle can perform at most ONE delivery
        for v in operational_vehicles:
            v_cand_indices = [idx for idx, cand in enumerate(candidates) if cand[0].id == v.id]
            if v_cand_indices:
                model.Add(sum(x_vars[idx] for idx in v_cand_indices) <= 1)

        # Constraint 2: Depot inventory cannot be exceeded
        for d in depots.values():
            for st, inv_qty in d.inventory.items():
                d_cand_indices = [
                    idx for idx, cand in enumerate(candidates)
                    if cand[1].id == d.id and cand[3] == st
                ]
                if d_cand_indices:
                    inv_int = int(round(inv_qty * QTY_SCALE))
                    model.Add(sum(q_vars[idx] for idx in d_cand_indices) <= inv_int)

        # Constraint 3 & Unmet Demand: Quantity delivered cannot exceed demand
        unmet_vars: Dict[Tuple[str, str], cp_model.IntVar] = {}
        unmet_objective_terms = []

        for p in demand_points.values():
            p_weight = PRIORITY_WEIGHTS.get(p.priority, 1_000)
            for st, req_qty in p.required_supplies.items():
                if req_qty <= 0:
                    continue

                req_int = int(round(req_qty * QTY_SCALE))
                p_cand_indices = [
                    idx for idx, cand in enumerate(candidates)
                    if cand[2].id == p.id and cand[3] == st
                ]

                u_var = model.NewIntVar(0, req_int, f"unmet_{p.id}_{st.value}")
                unmet_vars[(p.id, st.value)] = u_var

                if p_cand_indices:
                    model.Add(u_var == req_int - sum(q_vars[idx] for idx in p_cand_indices))
                else:
                    model.Add(u_var == req_int)

                unmet_objective_terms.append(p_weight * u_var)

        # 5. OBJECTIVE: Minimize weighted combination of unmet demand, distance, and travel time
        routing_objective_terms = []
        for idx, (v, d, p, st, r, _) in enumerate(candidates):
            dist_cost = int(round(r.distance * 10))
            time_cost = int(round(r.travel_time * 100))
            routing_objective_terms.append((dist_cost + time_cost) * x_vars[idx])

        model.Minimize(sum(unmet_objective_terms) + sum(routing_objective_terms))

        # 6. Solve with CP-SAT solver
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 15.0
        status_code = solver.Solve(model)

        status_mapping = {
            cp_model.OPTIMAL: "OPTIMAL",
            cp_model.FEASIBLE: "FEASIBLE",
            cp_model.INFEASIBLE: "INFEASIBLE",
            cp_model.MODEL_INVALID: "MODEL_INVALID",
            cp_model.UNKNOWN: "NO_SOLUTION",
        }
        status_str = status_mapping.get(status_code, "UNKNOWN")

        deliveries: List[OptimizationDelivery] = []
        calculated_unmet: Dict[str, Dict[str, float]] = {
            p_id: {st.value: float(qty) for st, qty in p.required_supplies.items() if qty > 0}
            for p_id, p in demand_points.items()
        }
        inv_used: Dict[str, Dict[str, float]] = {
            d_id: {st.value: 0.0 for st in d.inventory}
            for d_id, d in depots.items()
        }
        inv_remaining: Dict[str, Dict[str, float]] = {
            d_id: {st.value: float(qty) for st, qty in d.inventory.items()}
            for d_id, d in depots.items()
        }

        if status_code in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            for idx, (v, d, p, st, r, _) in enumerate(candidates):
                if solver.Value(x_vars[idx]) == 1:
                    qty = round(solver.Value(q_vars[idx]) / QTY_SCALE, 2)
                    if qty > 0:
                        deliveries.append(
                            OptimizationDelivery(
                                vehicle_id=v.id,
                                depot_id=d.id,
                                demand_point_id=p.id,
                                supply_type=st,
                                quantity=qty,
                                route_id=r.id,
                                distance=float(r.distance),
                                eta=float(r.travel_time),
                            )
                        )
                        st_key = st.value
                        inv_used[d.id][st_key] = round(inv_used[d.id].get(st_key, 0.0) + qty, 2)
                        inv_remaining[d.id][st_key] = round(
                            max(0.0, d.inventory.get(st, 0.0) - inv_used[d.id][st_key]), 2
                        )

            for (p_id, st_str), u_var in unmet_vars.items():
                calculated_unmet[p_id][st_str] = round(solver.Value(u_var) / QTY_SCALE, 2)

            total_dist = round(sum(dl.distance for dl in deliveries), 2)
            total_eta = round(sum(dl.eta for dl in deliveries), 2)
            total_sup = round(sum(dl.quantity for dl in deliveries), 2)
            total_unmet = round(sum(sum(dp_u.values()) for dp_u in calculated_unmet.values()), 2)
            obj_val = float(solver.ObjectiveValue())
        else:
            total_dist = 0.0
            total_eta = 0.0
            total_sup = 0.0
            total_unmet = total_initial_unmet
            inv_used = initial_inv_used
            inv_remaining = initial_inv_rem
            obj_val = 0.0

        return OptimizationResult(
            status=status_str,
            objective_value=obj_val,
            deliveries=deliveries,
            unmet_demand=calculated_unmet,
            total_supplied=total_sup,
            total_unmet_demand=total_unmet,
            inventory_used=inv_used,
            inventory_remaining=inv_remaining,
            total_distance=total_dist,
            total_eta=total_eta,
        )


# Singleton service instance
optimizer_service = LogisticsOptimizerService()


def optimize_logistics(state: LogisticsState) -> OptimizationResult:
    """Helper function to execute logistics optimization."""
    return optimizer_service.optimize(state)


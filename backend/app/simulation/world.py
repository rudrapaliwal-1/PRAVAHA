"""
simulation/world.py — Deterministic simulation data generator and state service for MissionPath.

Provides:
- 3 Depots with varied inventory levels
- 10 Vehicles with distinct capabilities and locations
- 6 Demand Points with priorities, deadlines, and consumption rates
- 12 Routes connecting depots and demand points with distance, time, and risk metrics
"""

from datetime import datetime, timezone
from typing import Dict, List

from app.models.common import Priority, RiskLevel, SupplyType
from app.models.demand_point import DemandPoint
from app.models.depot import Depot
from app.models.logistics_state import LogisticsState
from app.models.route import Route
from app.models.vehicle import Location, Vehicle


def create_initial_logistics_state() -> LogisticsState:
    """
    Constructs a deterministic simulated LogisticsState for disaster/military operations.
    All IDs, coordinates, and metrics are completely deterministic.
    """

    # -------------------------------------------------------------------------
    # 1. DEPOTS (3)
    # -------------------------------------------------------------------------
    depots: Dict[str, Depot] = {
        "DEPOT-ALPHA": Depot(
            id="DEPOT-ALPHA",
            location=Location(lat=30.3165, lon=78.0322),  # Forward Staging Base Alpha
            inventory={
                SupplyType.MEDICAL: 6000.0,
                SupplyType.WATER: 30000.0,
                SupplyType.FOOD: 22000.0,
                SupplyType.FUEL: 18000.0,
                SupplyType.EQUIPMENT: 5000.0,
            },
        ),
        "DEPOT-BRAVO": Depot(
            id="DEPOT-BRAVO",
            location=Location(lat=30.1058, lon=78.2880),  # Central Logistics Hub Bravo
            inventory={
                SupplyType.MEDICAL: 4000.0,
                SupplyType.WATER: 20000.0,
                SupplyType.FOOD: 15000.0,
                SupplyType.FUEL: 12000.0,
                SupplyType.EQUIPMENT: 7500.0,
            },
        ),
        "DEPOT-CHARLIE": Depot(
            id="DEPOT-CHARLIE",
            location=Location(lat=30.1897, lon=78.1804),  # Airfield Support Depot Charlie
            inventory={
                SupplyType.MEDICAL: 9000.0,
                SupplyType.WATER: 15000.0,
                SupplyType.FOOD: 12000.0,
                SupplyType.FUEL: 35000.0,
                SupplyType.EQUIPMENT: 6000.0,
            },
        ),
    }

    # -------------------------------------------------------------------------
    # 2. VEHICLES (10)
    # -------------------------------------------------------------------------
    vehicles: Dict[str, Vehicle] = {
        "VEH-01": Vehicle(
            id="VEH-01",
            capacity=8000.0,
            current_location=Location(lat=30.3165, lon=78.0322),
            available=True,
            fuel_level=95.0,
            speed=55.0,
        ),
        "VEH-02": Vehicle(
            id="VEH-02",
            capacity=7500.0,
            current_location=Location(lat=30.3165, lon=78.0322),
            available=True,
            fuel_level=88.0,
            speed=55.0,
        ),
        "VEH-03": Vehicle(
            id="VEH-03",
            capacity=5000.0,
            current_location=Location(lat=30.1058, lon=78.2880),
            available=True,
            fuel_level=78.0,
            speed=60.0,
        ),
        "VEH-04": Vehicle(
            id="VEH-04",
            capacity=4500.0,
            current_location=Location(lat=30.1058, lon=78.2880),
            available=True,
            fuel_level=65.0,
            speed=60.0,
        ),
        "VEH-05": Vehicle(
            id="VEH-05",
            capacity=6000.0,
            current_location=Location(lat=30.1897, lon=78.1804),
            available=True,
            fuel_level=100.0,
            speed=50.0,
        ),
        "VEH-06": Vehicle(
            id="VEH-06",
            capacity=3000.0,
            current_location=Location(lat=30.1897, lon=78.1804),
            available=True,
            fuel_level=82.0,
            speed=70.0,
        ),
        "VEH-07": Vehicle(
            id="VEH-07",
            capacity=2500.0,
            current_location=Location(lat=30.2800, lon=78.4500),
            available=True,
            fuel_level=55.0,
            speed=65.0,
        ),
        "VEH-08": Vehicle(
            id="VEH-08",
            capacity=12000.0,  # Heavy logistics transport
            current_location=Location(lat=30.3165, lon=78.0322),
            available=True,
            fuel_level=90.0,
            speed=45.0,
        ),
        "VEH-09": Vehicle(
            id="VEH-09",
            capacity=1500.0,  # Rapid light utility / high speed
            current_location=Location(lat=30.1058, lon=78.2880),
            available=True,
            fuel_level=92.0,
            speed=80.0,
        ),
        "VEH-10": Vehicle(
            id="VEH-10",
            capacity=4000.0,
            current_location=Location(lat=30.1897, lon=78.1804),
            available=False,  # Currently scheduled for field maintenance
            fuel_level=40.0,
            speed=55.0,
        ),
    }

    # -------------------------------------------------------------------------
    # 3. DEMAND POINTS (6)
    # -------------------------------------------------------------------------
    demand_points: Dict[str, DemandPoint] = {
        "DEMAND-01": DemandPoint(
            id="DEMAND-01",
            location=Location(lat=30.5500, lon=78.4000),  # Field Hospital North
            required_supplies={
                SupplyType.MEDICAL: 1200.0,
                SupplyType.WATER: 4000.0,
                SupplyType.FOOD: 2500.0,
                SupplyType.FUEL: 1500.0,
                SupplyType.EQUIPMENT: 600.0,
            },
            priority=Priority.CRITICAL,
            deadline=datetime(2026, 10, 3, 6, 0, 0, tzinfo=timezone.utc),
            consumption_rate={
                SupplyType.MEDICAL: 45.0,
                SupplyType.WATER: 120.0,
                SupplyType.FOOD: 80.0,
                SupplyType.FUEL: 30.0,
                SupplyType.EQUIPMENT: 10.0,
            },
        ),
        "DEMAND-02": DemandPoint(
            id="DEMAND-02",
            location=Location(lat=30.4100, lon=78.5200),  # Valley Evacuation Shelter
            required_supplies={
                SupplyType.FOOD: 6000.0,
                SupplyType.WATER: 8000.0,
                SupplyType.MEDICAL: 900.0,
                SupplyType.FUEL: 2200.0,
                SupplyType.EQUIPMENT: 1100.0,
            },
            priority=Priority.HIGH,
            deadline=datetime(2026, 10, 3, 12, 0, 0, tzinfo=timezone.utc),
            consumption_rate={
                SupplyType.FOOD: 160.0,
                SupplyType.WATER: 220.0,
                SupplyType.MEDICAL: 25.0,
                SupplyType.FUEL: 40.0,
                SupplyType.EQUIPMENT: 15.0,
            },
        ),
        "DEMAND-03": DemandPoint(
            id="DEMAND-03",
            location=Location(lat=30.7200, lon=78.6100),  # Mountain Forward Outpost Echo
            required_supplies={
                SupplyType.FUEL: 4000.0,
                SupplyType.EQUIPMENT: 1800.0,
                SupplyType.FOOD: 2000.0,
                SupplyType.WATER: 2500.0,
                SupplyType.MEDICAL: 500.0,
            },
            priority=Priority.HIGH,
            deadline=datetime(2026, 10, 3, 18, 0, 0, tzinfo=timezone.utc),
            consumption_rate={
                SupplyType.FUEL: 75.0,
                SupplyType.EQUIPMENT: 25.0,
                SupplyType.FOOD: 40.0,
                SupplyType.WATER: 50.0,
                SupplyType.MEDICAL: 12.0,
            },
        ),
        "DEMAND-04": DemandPoint(
            id="DEMAND-04",
            location=Location(lat=30.2800, lon=78.4500),  # Central Relief Distribution Center
            required_supplies={
                SupplyType.WATER: 5500.0,
                SupplyType.FOOD: 4800.0,
                SupplyType.MEDICAL: 1100.0,
                SupplyType.FUEL: 1400.0,
                SupplyType.EQUIPMENT: 900.0,
            },
            priority=Priority.MEDIUM,
            deadline=datetime(2026, 10, 4, 0, 0, 0, tzinfo=timezone.utc),
            consumption_rate={
                SupplyType.WATER: 110.0,
                SupplyType.FOOD: 95.0,
                SupplyType.MEDICAL: 20.0,
                SupplyType.FUEL: 25.0,
                SupplyType.EQUIPMENT: 10.0,
            },
        ),
        "DEMAND-05": DemandPoint(
            id="DEMAND-05",
            location=Location(lat=30.3900, lon=78.1500),  # Bridgehead Checkpoint Zulu
            required_supplies={
                SupplyType.FUEL: 2600.0,
                SupplyType.EQUIPMENT: 2200.0,
                SupplyType.FOOD: 1300.0,
                SupplyType.WATER: 1600.0,
                SupplyType.MEDICAL: 350.0,
            },
            priority=Priority.MEDIUM,
            deadline=datetime(2026, 10, 4, 6, 0, 0, tzinfo=timezone.utc),
            consumption_rate={
                SupplyType.FUEL: 50.0,
                SupplyType.EQUIPMENT: 30.0,
                SupplyType.FOOD: 25.0,
                SupplyType.WATER: 30.0,
                SupplyType.MEDICAL: 6.0,
            },
        ),
        "DEMAND-06": DemandPoint(
            id="DEMAND-06",
            location=Location(lat=30.6200, lon=78.2500),  # Isolated Gorge Sector Foxtrot
            required_supplies={
                SupplyType.MEDICAL: 1600.0,
                SupplyType.WATER: 3500.0,
                SupplyType.FOOD: 3200.0,
                SupplyType.FUEL: 1100.0,
                SupplyType.EQUIPMENT: 450.0,
            },
            priority=Priority.CRITICAL,
            deadline=datetime(2026, 10, 3, 4, 0, 0, tzinfo=timezone.utc),
            consumption_rate={
                SupplyType.MEDICAL: 55.0,
                SupplyType.WATER: 95.0,
                SupplyType.FOOD: 85.0,
                SupplyType.FUEL: 20.0,
                SupplyType.EQUIPMENT: 10.0,
            },
        ),
    }

    # -------------------------------------------------------------------------
    # 4. ROUTES (12)
    # -------------------------------------------------------------------------
    routes: Dict[str, Route] = {
        "ROUTE-01": Route(
            id="ROUTE-01",
            source=depots["DEPOT-ALPHA"].location,
            destination=demand_points["DEMAND-05"].location,
            distance=16.5,
            travel_time=0.45,  # implied speed ~36.7 km/h
            risk=RiskLevel.SAFE,
            available=True,
        ),
        "ROUTE-02": Route(
            id="ROUTE-02",
            source=depots["DEPOT-ALPHA"].location,
            destination=demand_points["DEMAND-06"].location,
            distance=41.0,
            travel_time=1.10,  # implied speed ~37.3 km/h
            risk=RiskLevel.MEDIUM,
            available=True,
        ),
        "ROUTE-03": Route(
            id="ROUTE-03",
            source=depots["DEPOT-ALPHA"].location,
            destination=demand_points["DEMAND-01"].location,
            distance=52.0,
            travel_time=1.35,  # implied speed ~38.5 km/h
            risk=RiskLevel.LOW,
            available=True,
        ),
        "ROUTE-04": Route(
            id="ROUTE-04",
            source=depots["DEPOT-BRAVO"].location,
            destination=demand_points["DEMAND-04"].location,
            distance=25.0,
            travel_time=0.60,  # implied speed ~41.7 km/h
            risk=RiskLevel.SAFE,
            available=True,
        ),
        "ROUTE-05": Route(
            id="ROUTE-05",
            source=depots["DEPOT-BRAVO"].location,
            destination=demand_points["DEMAND-02"].location,
            distance=43.5,
            travel_time=1.15,  # implied speed ~37.8 km/h
            risk=RiskLevel.LOW,
            available=True,
        ),
        "ROUTE-06": Route(
            id="ROUTE-06",
            source=depots["DEPOT-CHARLIE"].location,
            destination=demand_points["DEMAND-04"].location,
            distance=31.0,
            travel_time=0.75,  # implied speed ~41.3 km/h
            risk=RiskLevel.SAFE,
            available=True,
        ),
        "ROUTE-07": Route(
            id="ROUTE-07",
            source=depots["DEPOT-CHARLIE"].location,
            destination=demand_points["DEMAND-01"].location,
            distance=48.0,
            travel_time=1.20,  # implied speed ~40.0 km/h
            risk=RiskLevel.MEDIUM,
            available=True,
        ),
        "ROUTE-08": Route(
            id="ROUTE-08",
            source=demand_points["DEMAND-01"].location,
            destination=demand_points["DEMAND-03"].location,
            distance=32.0,
            travel_time=0.90,  # implied speed ~35.6 km/h
            risk=RiskLevel.HIGH,
            available=True,
        ),
        "ROUTE-09": Route(
            id="ROUTE-09",
            source=demand_points["DEMAND-02"].location,
            destination=demand_points["DEMAND-03"].location,
            distance=38.0,
            travel_time=1.05,  # implied speed ~36.2 km/h
            risk=RiskLevel.HIGH,
            available=True,
        ),
        "ROUTE-10": Route(
            id="ROUTE-10",
            source=demand_points["DEMAND-05"].location,
            destination=demand_points["DEMAND-06"].location,
            distance=29.5,
            travel_time=0.80,  # implied speed ~36.9 km/h
            risk=RiskLevel.LOW,
            available=True,
        ),
        "ROUTE-11": Route(
            id="ROUTE-11",
            source=demand_points["DEMAND-04"].location,
            destination=demand_points["DEMAND-02"].location,
            distance=18.0,
            travel_time=0.50,  # implied speed ~36.0 km/h
            risk=RiskLevel.SAFE,
            available=True,
        ),
        "ROUTE-12": Route(
            id="ROUTE-12",
            source=demand_points["DEMAND-06"].location,
            destination=demand_points["DEMAND-01"].location,
            distance=22.0,
            travel_time=0.70,  # implied speed ~31.4 km/h
            risk=RiskLevel.BLOCKED,  # Simulates landslide / bridge outage
            available=False,
        ),
    }

    return LogisticsState(
        vehicles=vehicles,
        depots=depots,
        demand_points=demand_points,
        routes=routes,
        deliveries=[],
    )


class WorldStateService:
    """
    Singleton-style in-memory service managing the simulation world state.
    Provides thread-safe access and reset functionality for testing.
    """

    def __init__(self) -> None:
        self._state: LogisticsState = create_initial_logistics_state()

    def get_state(self) -> LogisticsState:
        """Returns the current LogisticsState."""
        return self._state

    def reset_state(self) -> LogisticsState:
        """Resets the state back to the initial deterministic baseline."""
        self._state = create_initial_logistics_state()
        return self._state


# Global module singleton instance
world_state_service = WorldStateService()

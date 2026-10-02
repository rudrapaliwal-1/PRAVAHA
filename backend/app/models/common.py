"""
models/common.py — Shared types and enums used across all logistics models.
"""

from enum import Enum


class SupplyType(str, Enum):
    """Categories of supplies that can be transported."""
    FOOD = "food"
    WATER = "water"
    MEDICINE = "medicine"
    MEDICAL = "medicine"  # Alias for medical supplies
    AMMUNITION = "ammunition"
    FUEL = "fuel"
    EQUIPMENT = "equipment"
    PERSONNEL = "personnel"
    OTHER = "other"


class Priority(str, Enum):
    """Urgency level for a demand point."""
    CRITICAL = "critical"   # Life-threatening — act immediately
    HIGH = "high"           # Serious impact if delayed > 2 h
    MEDIUM = "medium"       # Standard operational need
    LOW = "low"             # Can wait — opportunistic delivery


class DeliveryStatus(str, Enum):
    """Lifecycle states of a delivery."""
    PENDING = "pending"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RiskLevel(str, Enum):
    """Threat / hazard level on a route."""
    SAFE = "safe"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    BLOCKED = "blocked"

"""
models/copilot.py — Pydantic models for AI Logistics Copilot.

Defines schemas for natural language queries, grounded context bundles,
and explanation responses.
"""

from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, Field


class CopilotRequest(BaseModel):
    """
    User query request sent to the AI Logistics Copilot.
    """
    question: str = Field(..., min_length=1, description="Question or prompt for the logistics copilot")
    context: Optional[str] = Field(default=None, description="Optional extra contextual notes or focus area")
    include_optimization: bool = Field(default=True, description="Whether to include active optimization results")
    include_resilience: bool = Field(default=True, description="Whether to include resilience scores in context")
    include_shortages: bool = Field(default=True, description="Whether to include predicted shortages in context")

    model_config = {"frozen": False}


class CopilotResponse(BaseModel):
    """
    Grounded explanation response synthesized by the copilot.
    """
    answer: str = Field(..., description="Grounded explanation synthesized by the copilot")
    referenced_entities: List[str] = Field(
        default_factory=list,
        description="IDs of vehicles, routes, depots, or demand points referenced in the answer",
    )
    context_summary: str = Field(
        ...,
        description="Summary of operational state and metrics provided to the copilot",
    )
    provider: str = Field(
        default="grounded_copilot_engine",
        description="AI model provider or grounded explanation engine",
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp of response generation",
    )

    model_config = {"frozen": False}

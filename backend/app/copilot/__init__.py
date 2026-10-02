"""
copilot — AI Logistics Copilot explanation layer grounded in CP-SAT solver results.
"""

from app.copilot.context_builder import CopilotContextBuilder, context_builder
from app.copilot.llm_client import (
    BaseCopilotLLM,
    DeterministicGroundedCopilot,
    ExternalLLMClient,
    get_copilot_llm,
)
from app.copilot.service import LogisticsCopilotService, copilot_service

__all__ = [
    "LogisticsCopilotService",
    "copilot_service",
    "CopilotContextBuilder",
    "context_builder",
    "BaseCopilotLLM",
    "DeterministicGroundedCopilot",
    "ExternalLLMClient",
    "get_copilot_llm",
]

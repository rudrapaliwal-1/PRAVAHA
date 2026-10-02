"""
copilot/service.py — AI Logistics Copilot Orchestration Service.

Ingests user questions, gathers ground-truth network state and optimization telemetry,
and generates non-hallucinatory explanations.
"""

from datetime import datetime, timezone
from typing import Optional

from app.copilot.context_builder import context_builder
from app.copilot.llm_client import BaseCopilotLLM, get_copilot_llm
from app.models.copilot import CopilotRequest, CopilotResponse
from app.models.logistics_state import LogisticsState


class LogisticsCopilotService:
    """
    Orchestration service for the AI Logistics Copilot explanation layer.
    """

    def __init__(self, llm_client: Optional[BaseCopilotLLM] = None) -> None:
        self._llm = llm_client or get_copilot_llm()

    def set_llm_client(self, client: BaseCopilotLLM) -> None:
        """Allows swapping LLM client (e.g. for testing / mocking)."""
        self._llm = client

    def ask(
        self,
        request: CopilotRequest,
        state: Optional[LogisticsState] = None,
    ) -> CopilotResponse:
        """
        Synthesizes an explanation for a user prompt grounded in current state.

        Args:
            request: CopilotRequest containing user question and context flags.
            state: Optional custom LogisticsState (defaults to world state).

        Returns:
            CopilotResponse: Grounded answer, referenced entities, and context summary.
        """
        # 1. Build comprehensive grounding context
        context_bundle = context_builder.build_context(
            state=state,
            custom_context=request.context,
            include_optimization=request.include_optimization,
            include_resilience=request.include_resilience,
            include_shortages=request.include_shortages,
        )

        # 2. Generate explanation via LLM explanation engine
        answer_text, referenced_entities, provider_name = self._llm.generate_explanation(
            question=request.question,
            context=context_bundle,
        )

        return CopilotResponse(
            answer=answer_text,
            referenced_entities=referenced_entities,
            context_summary=context_bundle.get("summary_text", ""),
            provider=provider_name,
            timestamp=datetime.now(timezone.utc),
        )


# Singleton copilot service
copilot_service = LogisticsCopilotService()

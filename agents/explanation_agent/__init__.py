"""Production Explanation Agent package exports."""

from services.production_explanation_service import ProductionExplanationService

try:
    from .register import ExplanationAgentConfig, explanation_agent
except ModuleNotFoundError:
    ExplanationAgentConfig = None
    explanation_agent = None

__all__ = [
    "ProductionExplanationService",
    "ExplanationAgentConfig",
    "explanation_agent",
]

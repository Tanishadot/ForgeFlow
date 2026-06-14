"""Scheduler Agent package exports."""

from .production_scheduler import SchedulerAgent, SchedulerConfig, create_production_schedule

try:
    from .register import SchedulerAgentConfig, scheduler_agent
except ModuleNotFoundError:
    SchedulerAgentConfig = None
    scheduler_agent = None

__all__ = [
    "SchedulerAgent",
    "SchedulerConfig",
    "create_production_schedule",
    "SchedulerAgentConfig",
    "scheduler_agent",
]

"""Machine Agent package exports."""

from .machine_allocator import MachineAgent, MachineAllocationConfig, allocate_machine

try:
    from .register import MachineAgentConfig, machine_agent
except ModuleNotFoundError:
    MachineAgentConfig = None
    machine_agent = None

__all__ = [
    "MachineAgent",
    "MachineAllocationConfig",
    "allocate_machine",
    "MachineAgentConfig",
    "machine_agent",
]

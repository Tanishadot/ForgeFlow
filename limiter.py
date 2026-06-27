"""Shared slowapi rate limiter instance.

Imported by main.py (to register exception handler) and by individual route
modules (to apply @limiter.limit decorators). Kept in its own file to avoid
the circular import that would arise if routes imported from main.py.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=[])

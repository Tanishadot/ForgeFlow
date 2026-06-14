"""
Routes package for Data Ingestion Service.
Contains API endpoint definitions.
"""

from .data_routes import router as data_router

__all__ = ["data_router"]

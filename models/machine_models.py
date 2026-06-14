"""
Machine models for Data Ingestion Service.
Defines the schema for machines.csv data validation.
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class Machine(BaseModel):
    """
    Represents a single machine record.
    All fields are optional to handle missing columns gracefully.
    """
    machine_id: Optional[str] = Field(
        None,
        description="Unique identifier for the machine"
    )
    machine_name: Optional[str] = Field(
        None,
        description="Name or label of the machine"
    )
    machine_type: Optional[str] = Field(
        None,
        description="Type or category of the machine"
    )
    location: Optional[str] = Field(
        None,
        description="Physical location of the machine"
    )
    status: Optional[str] = Field(
        None,
        description="Current operational status (e.g., active, maintenance, offline)"
    )
    capacity: Optional[float] = Field(
        None,
        description="Production capacity of the machine"
    )
    efficiency: Optional[float] = Field(
        None,
        description="Efficiency rating as a percentage"
    )
    last_maintenance_date: Optional[str] = Field(
        None,
        description="Date of last maintenance (YYYY-MM-DD format)"
    )
    operator_id: Optional[str] = Field(
        None,
        description="Identifier of the primary operator"
    )
    
    class Config:
        """
        Pydantic configuration for Machine model.
        Allows extra fields to handle additional columns not defined in schema.
        """
        extra = "allow"


class MachineResponse(BaseModel):
    """
    Response model for machine data operations.
    Contains metadata about the processed machines.
    """
    total_machines: int = Field(
        ...,
        description="Total number of machines processed"
    )
    machines: list[Dict[str, Any]] = Field(
        ...,
        description="List of machine records as dictionaries"
    )
    schema_validation: Dict[str, Any] = Field(
        ...,
        description="Schema validation results including missing/extra columns"
    )

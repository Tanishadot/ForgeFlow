"""
Common models used across the Data Ingestion Service.
Contains response models and error handling structures.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ValidationError(BaseModel):
    """
    Represents a validation error for a specific field or row.
    """
    field: Optional[str] = Field(
        None, 
        description="The field that caused the validation error"
    )
    row: Optional[int] = Field(
        None, 
        description="The row number where the error occurred (0-indexed)"
    )
    message: str = Field(
        ..., 
        description="Detailed error message describing the validation issue"
    )
    severity: str = Field(
        default="error",
        description="Severity level: 'error', 'warning', or 'info'"
    )


class UploadResponse(BaseModel):
    """
    Standard response model for file upload operations.
    Provides metadata about the uploaded and processed data.
    """
    success: bool = Field(
        ..., 
        description="Indicates whether the upload was successful"
    )
    message: str = Field(
        ..., 
        description="Human-readable status message"
    )
    filename: str = Field(
        ..., 
        description="Name of the uploaded file"
    )
    rows_processed: int = Field(
        ..., 
        description="Number of rows successfully processed"
    )
    columns_found: List[str] = Field(
        ..., 
        description="List of column names found in the CSV file"
    )
    missing_columns: List[str] = Field(
        default_factory=list,
        description="List of expected columns that were missing from the file"
    )
    validation_errors: List[ValidationError] = Field(
        default_factory=list,
        description="List of validation errors encountered during processing"
    )
    data: Optional[List[Dict[str, Any]]] = Field(
        None,
        description="Parsed data as a list of dictionaries (limited to first 100 rows)"
    )

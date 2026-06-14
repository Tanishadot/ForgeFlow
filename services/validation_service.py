"""
Validation Service for Data Ingestion Service.
Handles schema validation and data integrity checks.
"""

from typing import List, Dict, Any, Set
import pandas as pd
from models.common_models import ValidationError


class ValidationService:
    """
    Service class for validating CSV data against expected schemas.
    Handles missing columns, data type validation, and error reporting.
    """
    
    # Expected column definitions for each data type
    EXPECTED_SCHEMAS = {
        "orders": {
            "order_id": str,
            "customer_id": str,
            "order_date": str,
            "product_id": str,
            "quantity": int,
            "unit_price": float,
            "total_amount": float,
            "status": str,
            "shipping_address": str,
        },
        "machines": {
            "machine_id": str,
            "machine_name": str,
            "machine_type": str,
            "location": str,
            "status": str,
            "capacity": float,
            "efficiency": float,
            "last_maintenance_date": str,
            "operator_id": str,
        },
        "inventory": {
            "inventory_id": str,
            "product_id": str,
            "product_name": str,
            "sku": str,
            "quantity_on_hand": int,
            "reorder_level": int,
            "unit_cost": float,
            "location": str,
            "category": str,
            "supplier_id": str,
        },
    }
    
    @staticmethod
    def validate_schema(
        df: pd.DataFrame, 
        data_type: str
    ) -> tuple[List[str], List[str], List[ValidationError]]:
        """
        Validates the DataFrame schema against expected columns.
        
        Args:
            df: Pandas DataFrame containing the data to validate
            data_type: Type of data ('orders', 'machines', or 'inventory')
            
        Returns:
            Tuple of (columns_found, missing_columns, validation_errors)
        """
        expected_schema = ValidationService.EXPECTED_SCHEMAS.get(data_type, {})
        expected_columns = set(expected_schema.keys())
        actual_columns = set(df.columns)
        
        # Find missing and extra columns
        missing_columns = list(expected_columns - actual_columns)
        extra_columns = list(actual_columns - expected_columns)
        columns_found = list(actual_columns)
        
        validation_errors: List[ValidationError] = []
        
        # Add warnings for missing columns
        for col in missing_columns:
            validation_errors.append(
                ValidationError(
                    field=col,
                    message=f"Expected column '{col}' is missing from the CSV file",
                    severity="warning"
                )
            )
        
        # Add info for extra columns
        for col in extra_columns:
            validation_errors.append(
                ValidationError(
                    field=col,
                    message=f"Additional column '{col}' found in CSV (will be preserved)",
                    severity="info"
                )
            )
        
        # Validate data types for columns that exist
        for col in columns_found:
            if col in expected_schema:
                expected_type = expected_schema[col]
                ValidationService._validate_column_type(
                    df, col, expected_type, validation_errors
                )
        
        return columns_found, missing_columns, validation_errors
    
    @staticmethod
    def _validate_column_type(
        df: pd.DataFrame, 
        column: str, 
        expected_type: type,
        errors: List[ValidationError]
    ) -> None:
        """
        Validates the data type of a specific column.
        
        Args:
            df: Pandas DataFrame containing the data
            column: Column name to validate
            expected_type: Expected data type
            errors: List to append validation errors to
        """
        # Skip validation if column is empty
        if df[column].isna().all():
            return
        
        # Sample first non-null value for type checking
        sample_value = df[column].dropna().iloc[0] if not df[column].dropna().empty else None
        
        if sample_value is None:
            return
        
        try:
            if expected_type == int:
                # Check if values can be converted to int
                pd.to_numeric(df[column], errors='coerce')
            elif expected_type == float:
                # Check if values can be converted to float
                pd.to_numeric(df[column], errors='coerce')
            # For string type, no validation needed as everything can be string
        except (ValueError, TypeError) as e:
            errors.append(
                ValidationError(
                    field=column,
                    message=f"Data type validation failed for column '{column}': {str(e)}",
                    severity="warning"
                )
            )
    
    @staticmethod
    def validate_row_data(df: pd.DataFrame) -> List[ValidationError]:
        """
        Validates individual row data for common issues.
        
        Args:
            df: Pandas DataFrame containing the data
            
        Returns:
            List of validation errors found in the data
        """
        errors: List[ValidationError] = []
        
        # Check for completely empty rows
        empty_rows = df[df.isna().all(axis=1)]
        for idx in empty_rows.index:
            errors.append(
                ValidationError(
                    row=int(idx),
                    message=f"Row {idx} is completely empty",
                    severity="warning"
                )
            )
        
        return errors

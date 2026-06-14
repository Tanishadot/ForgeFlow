"""
Data Service for Data Ingestion Service.
Handles CSV parsing, data storage, and JSON conversion.
"""

from typing import List, Dict, Any, Optional
import pandas as pd
import io
from models.common_models import UploadResponse, ValidationError
from services.validation_service import ValidationService


class DataService:
    """
    Service class for managing data ingestion, storage, and retrieval.
    Stores data in memory using pandas DataFrames.
    """
    
    # In-memory storage for DataFrames
    _data_store: Dict[str, pd.DataFrame] = {
        "orders": pd.DataFrame(),
        "machines": pd.DataFrame(),
        "inventory": pd.DataFrame(),
    }
    
    @classmethod
    def get_data(cls, data_type: str) -> pd.DataFrame:
        """
        Retrieves stored data for a specific data type.
        
        Args:
            data_type: Type of data ('orders', 'machines', or 'inventory')
            
        Returns:
            Pandas DataFrame containing the stored data
        """
        return cls._data_store.get(data_type, pd.DataFrame())
    
    @classmethod
    def clear_data(cls, data_type: Optional[str] = None) -> None:
        """
        Clears stored data. If data_type is specified, only that type is cleared.
        Otherwise, all data is cleared.
        
        Args:
            data_type: Optional type of data to clear
        """
        if data_type:
            cls._data_store[data_type] = pd.DataFrame()
        else:
            for key in cls._data_store:
                cls._data_store[key] = pd.DataFrame()
    
    @classmethod
    async def process_csv_upload(
        cls,
        file_content: bytes,
        filename: str,
        data_type: str
    ) -> UploadResponse:
        """
        Processes a CSV file upload, validates schema, and stores data.
        
        Args:
            file_content: Raw bytes of the CSV file
            filename: Name of the uploaded file
            data_type: Type of data ('orders', 'machines', or 'inventory')
            
        Returns:
            UploadResponse containing processing results and validation info
        """
        try:
            # Read CSV file from bytes
            df = pd.read_csv(io.BytesIO(file_content))
            
            # Validate schema
            columns_found, missing_columns, validation_errors = (
                ValidationService.validate_schema(df, data_type)
            )
            
            # Validate row data
            row_errors = ValidationService.validate_row_data(df)
            validation_errors.extend(row_errors)
            
            # Store data in memory
            cls._data_store[data_type] = df
            
            # Convert to JSON (limit to first 100 rows for response)
            data_json = df.head(100).to_dict(orient='records')
            
            # Determine success based on critical errors
            critical_errors = [e for e in validation_errors if e.severity == "error"]
            success = len(critical_errors) == 0
            
            # Build response message
            if success:
                message = f"Successfully processed {len(df)} rows from {filename}"
            else:
                message = f"Processed {len(df)} rows from {filename} with {len(critical_errors)} errors"
            
            return UploadResponse(
                success=success,
                message=message,
                filename=filename,
                rows_processed=len(df),
                columns_found=columns_found,
                missing_columns=missing_columns,
                validation_errors=validation_errors,
                data=data_json
            )
            
        except pd.errors.EmptyDataError:
            return UploadResponse(
                success=False,
                message="The uploaded file is empty",
                filename=filename,
                rows_processed=0,
                columns_found=[],
                missing_columns=[],
                validation_errors=[
                    ValidationError(
                        message="CSV file is empty or contains no data",
                        severity="error"
                    )
                ]
            )
        except pd.errors.ParserError as e:
            return UploadResponse(
                success=False,
                message=f"Failed to parse CSV file: {str(e)}",
                filename=filename,
                rows_processed=0,
                columns_found=[],
                missing_columns=[],
                validation_errors=[
                    ValidationError(
                        message=f"CSV parsing error: {str(e)}",
                        severity="error"
                    )
                ]
            )
        except Exception as e:
            return UploadResponse(
                success=False,
                message=f"Unexpected error processing file: {str(e)}",
                filename=filename,
                rows_processed=0,
                columns_found=[],
                missing_columns=[],
                validation_errors=[
                    ValidationError(
                        message=f"Unexpected error: {str(e)}",
                        severity="error"
                    )
                ]
            )
    
    @classmethod
    def get_data_as_json(cls, data_type: str, limit: int = 1000) -> List[Dict[str, Any]]:
        """
        Retrieves stored data as JSON.
        
        Args:
            data_type: Type of data ('orders', 'machines', or 'inventory')
            limit: Maximum number of rows to return (default: 1000)
            
        Returns:
            List of dictionaries representing the data
        """
        df = cls.get_data(data_type)
        return df.head(limit).to_dict(orient='records')
    
    @classmethod
    def get_data_summary(cls, data_type: str) -> Dict[str, Any]:
        """
        Returns a summary of the stored data.
        
        Args:
            data_type: Type of data ('orders', 'machines', or 'inventory')
            
        Returns:
            Dictionary containing summary statistics
        """
        df = cls.get_data(data_type)
        
        if df.empty:
            return {
                "total_rows": 0,
                "total_columns": 0,
                "columns": [],
                "memory_usage_mb": 0.0,
            }
        
        return {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "columns": list(df.columns),
            "memory_usage_mb": df.memory_usage(deep=True).sum() / (1024 * 1024),
            "column_types": df.dtypes.astype(str).to_dict(),
        }

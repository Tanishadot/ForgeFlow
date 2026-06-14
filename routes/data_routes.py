"""
Data Routes for Data Ingestion Service.
Defines API endpoints for file uploads and data retrieval.
"""

from typing import Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from services.data_service import DataService
from models.common_models import UploadResponse

# Create router for data endpoints
router = APIRouter(prefix="/api/v1", tags=["data"])


@router.post("/upload/orders", response_model=UploadResponse)
async def upload_orders(file: UploadFile = File(...)):
    """
    Upload and process orders.csv file.
    
    Args:
        file: CSV file containing order data
        
    Returns:
        UploadResponse with processing results and validation info
        
    Raises:
        HTTPException: If file is not a CSV
    """
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are accepted"
        )
    
    # Read file content
    file_content = await file.read()
    
    # Process the upload
    result = await DataService.process_csv_upload(
        file_content=file_content,
        filename=file.filename,
        data_type="orders"
    )
    
    return result


@router.post("/upload/machines", response_model=UploadResponse)
async def upload_machines(file: UploadFile = File(...)):
    """
    Upload and process machines.csv file.
    
    Args:
        file: CSV file containing machine data
        
    Returns:
        UploadResponse with processing results and validation info
        
    Raises:
        HTTPException: If file is not a CSV
    """
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are accepted"
        )
    
    # Read file content
    file_content = await file.read()
    
    # Process the upload
    result = await DataService.process_csv_upload(
        file_content=file_content,
        filename=file.filename,
        data_type="machines"
    )
    
    return result


@router.post("/upload/inventory", response_model=UploadResponse)
async def upload_inventory(file: UploadFile = File(...)):
    """
    Upload and process inventory.csv file.
    
    Args:
        file: CSV file containing inventory data
        
    Returns:
        UploadResponse with processing results and validation info
        
    Raises:
        HTTPException: If file is not a CSV
    """
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are accepted"
        )
    
    # Read file content
    file_content = await file.read()
    
    # Process the upload
    result = await DataService.process_csv_upload(
        file_content=file_content,
        filename=file.filename,
        data_type="inventory"
    )
    
    return result


@router.get("/data/orders")
async def get_orders(limit: int = 1000):
    """
    Retrieve stored orders data as JSON.
    
    Args:
        limit: Maximum number of rows to return (default: 1000)
        
    Returns:
        JSON response with orders data
    """
    data = DataService.get_data_as_json("orders", limit)
    return {
        "data_type": "orders",
        "total_rows": len(data),
        "data": data
    }


@router.get("/data/machines")
async def get_machines(limit: int = 1000):
    """
    Retrieve stored machines data as JSON.
    
    Args:
        limit: Maximum number of rows to return (default: 1000)
        
    Returns:
        JSON response with machines data
    """
    data = DataService.get_data_as_json("machines", limit)
    return {
        "data_type": "machines",
        "total_rows": len(data),
        "data": data
    }


@router.get("/data/inventory")
async def get_inventory(limit: int = 1000):
    """
    Retrieve stored inventory data as JSON.
    
    Args:
        limit: Maximum number of rows to return (default: 1000)
        
    Returns:
        JSON response with inventory data
    """
    data = DataService.get_data_as_json("inventory", limit)
    return {
        "data_type": "inventory",
        "total_rows": len(data),
        "data": data
    }


@router.get("/summary/orders")
async def get_orders_summary():
    """
    Get summary statistics for stored orders data.
    
    Returns:
        JSON response with summary information
    """
    summary = DataService.get_data_summary("orders")
    return {
        "data_type": "orders",
        "summary": summary
    }


@router.get("/summary/machines")
async def get_machines_summary():
    """
    Get summary statistics for stored machines data.
    
    Returns:
        JSON response with summary information
    """
    summary = DataService.get_data_summary("machines")
    return {
        "data_type": "machines",
        "summary": summary
    }


@router.get("/summary/inventory")
async def get_inventory_summary():
    """
    Get summary statistics for stored inventory data.
    
    Returns:
        JSON response with summary information
    """
    summary = DataService.get_data_summary("inventory")
    return {
        "data_type": "inventory",
        "summary": summary
    }


@router.delete("/data/orders")
async def clear_orders():
    """
    Clear all stored orders data from memory.
    
    Returns:
        JSON response confirming deletion
    """
    DataService.clear_data("orders")
    return {
        "message": "Orders data cleared successfully",
        "data_type": "orders"
    }


@router.delete("/data/machines")
async def clear_machines():
    """
    Clear all stored machines data from memory.
    
    Returns:
        JSON response confirming deletion
    """
    DataService.clear_data("machines")
    return {
        "message": "Machines data cleared successfully",
        "data_type": "machines"
    }


@router.delete("/data/inventory")
async def clear_inventory():
    """
    Clear all stored inventory data from memory.
    
    Returns:
        JSON response confirming deletion
    """
    DataService.clear_data("inventory")
    return {
        "message": "Inventory data cleared successfully",
        "data_type": "inventory"
    }


@router.delete("/data/all")
async def clear_all_data():
    """
    Clear all stored data from memory.
    
    Returns:
        JSON response confirming deletion
    """
    DataService.clear_data()
    return {
        "message": "All data cleared successfully",
        "data_types": ["orders", "machines", "inventory"]
    }


@router.get("/health")
async def health_check():
    """
    Health check endpoint to verify service status.
    
    Returns:
        JSON response with service health status
    """
    return {
        "status": "healthy",
        "service": "Data Ingestion Service",
        "data_store_status": {
            "orders": len(DataService.get_data("orders")),
            "machines": len(DataService.get_data("machines")),
            "inventory": len(DataService.get_data("inventory")),
        }
    }

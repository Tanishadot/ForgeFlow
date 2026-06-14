"""
Inventory models for Data Ingestion Service.
Defines the schema for inventory.csv data validation.
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class Inventory(BaseModel):
    """
    Represents a single inventory record.
    All fields are optional to handle missing columns gracefully.
    """
    inventory_id: Optional[str] = Field(
        None,
        description="Unique identifier for the inventory item"
    )
    product_id: Optional[str] = Field(
        None,
        description="Identifier for the product"
    )
    product_name: Optional[str] = Field(
        None,
        description="Name of the product"
    )
    sku: Optional[str] = Field(
        None,
        description="Stock Keeping Unit code"
    )
    quantity_on_hand: Optional[int] = Field(
        None,
        description="Current quantity in stock"
    )
    reorder_level: Optional[int] = Field(
        None,
        description="Minimum quantity threshold for reordering"
    )
    unit_cost: Optional[float] = Field(
        None,
        description="Cost per unit"
    )
    location: Optional[str] = Field(
        None,
        description="Storage location (e.g., warehouse, shelf)"
    )
    category: Optional[str] = Field(
        None,
        description="Product category"
    )
    supplier_id: Optional[str] = Field(
        None,
        description="Identifier of the supplier"
    )
    
    class Config:
        """
        Pydantic configuration for Inventory model.
        Allows extra fields to handle additional columns not defined in schema.
        """
        extra = "allow"


class InventoryResponse(BaseModel):
    """
    Response model for inventory data operations.
    Contains metadata about the processed inventory items.
    """
    total_items: int = Field(
        ...,
        description="Total number of inventory items processed"
    )
    inventory: list[Dict[str, Any]] = Field(
        ...,
        description="List of inventory records as dictionaries"
    )
    schema_validation: Dict[str, Any] = Field(
        ...,
        description="Schema validation results including missing/extra columns"
    )

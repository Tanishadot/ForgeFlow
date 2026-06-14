"""
Order models for Data Ingestion Service.
Defines the schema for orders.csv data validation.
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class Order(BaseModel):
    """
    Represents a single order record.
    All fields are optional to handle missing columns gracefully.
    """
    order_id: Optional[str] = Field(
        None,
        description="Unique identifier for the order"
    )
    customer_id: Optional[str] = Field(
        None,
        description="Unique identifier for the customer"
    )
    order_date: Optional[str] = Field(
        None,
        description="Date when the order was placed (YYYY-MM-DD format)"
    )
    product_id: Optional[str] = Field(
        None,
        description="Identifier for the product ordered"
    )
    quantity: Optional[int] = Field(
        None,
        description="Quantity of items ordered"
    )
    unit_price: Optional[float] = Field(
        None,
        description="Price per unit"
    )
    total_amount: Optional[float] = Field(
        None,
        description="Total amount for the order line item"
    )
    status: Optional[str] = Field(
        None,
        description="Order status (e.g., pending, shipped, delivered)"
    )
    shipping_address: Optional[str] = Field(
        None,
        description="Shipping address for the order"
    )
    
    class Config:
        """
        Pydantic configuration for Order model.
        Allows extra fields to handle additional columns not defined in schema.
        """
        extra = "allow"


class OrderResponse(BaseModel):
    """
    Response model for order data operations.
    Contains metadata about the processed orders.
    """
    total_orders: int = Field(
        ...,
        description="Total number of orders processed"
    )
    orders: list[Dict[str, Any]] = Field(
        ...,
        description="List of order records as dictionaries"
    )
    schema_validation: Dict[str, Any] = Field(
        ...,
        description="Schema validation results including missing/extra columns"
    )

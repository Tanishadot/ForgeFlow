"""
Main entry point for Data Ingestion Service.
FastAPI application for uploading and processing CSV files.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.data_routes import router as data_router
from routes.explanation_routes import router as explanation_router
from routes.copilot_routes import router as copilot_router

# Create FastAPI application instance
app = FastAPI(
    title="Data Ingestion Service",
    description="A FastAPI service for uploading, validating, and processing CSV data files (orders, machines, inventory). Data is stored in memory using pandas DataFrames and returned as parsed JSON.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS middleware to allow cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include data routes
app.include_router(data_router)
app.include_router(explanation_router)
app.include_router(copilot_router)


@app.get("/")
async def root():
    """
    Root endpoint providing basic service information.
    
    Returns:
        JSON response with service details
    """
    return {
        "service": "Data Ingestion Service",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "docs": "/docs",
            "redoc": "/redoc",
            "health": "/api/v1/health",
            "upload_orders": "/api/v1/upload/orders",
            "upload_machines": "/api/v1/upload/machines",
            "upload_inventory": "/api/v1/upload/inventory",
            "explain": "/explain",
        }
    }


if __name__ == "__main__":
    import uvicorn
    
    # Run the application using uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Enable auto-reload during development
        log_level="info"
    )

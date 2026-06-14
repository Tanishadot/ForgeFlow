"""
Main entry point for ForgeFlow AI.
FastAPI application for production planning with NVIDIA NIM integration.
"""

from fastapi import FastAPI
from settings import settings  # loads .env on import
from fastapi.middleware.cors import CORSMiddleware
from routes.data_routes import router as data_router
from routes.explanation_routes import router as explanation_router
from routes.copilot_routes import router as copilot_router
from routes.schedule_routes import router as schedule_router

# Create FastAPI application instance
app = FastAPI(
    title="ForgeFlow AI",
    description="AI-powered production planning for manufacturing. Powered by NVIDIA NIM.",
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
app.include_router(schedule_router)


@app.get("/")
async def root():
    """
    Root endpoint providing basic service information.
    
    Returns:
        JSON response with service details
    """
    return {
        "service": "ForgeFlow AI",
        "version": "1.0.0",
        "status": "running",
        "nim": {
            "configured": settings.nim_is_configured,
            "model": settings.nvidia_nim_model if settings.nim_is_configured else None,
        },
        "endpoints": {
            "docs": "/docs",
            "health": "/api/v1/health",
            "schedule": "/api/v1/schedule",
            "whatif": "/api/v1/whatif",
            "seed": "/api/v1/seed",
            "copilot": "/copilot/chat",
            "explain": "/explain",
        },
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

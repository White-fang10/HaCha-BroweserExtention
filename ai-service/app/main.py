"""
HaCha AI Verification Service - Phase 8
FastAPI application entry point.
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.logging import setup_logging, get_logger
from app.api.routes import health, verify


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler - startup and shutdown."""
    settings = get_settings()

    # Setup logging
    setup_logging(settings.log_level)
    logger = get_logger(__name__)

    logger.info("AI Service starting up",
                extra={
                    "service": settings.service_name,
                    "version": settings.version,
                    "environment": settings.environment,
                })

    yield

    # Shutdown
    logger.info("AI Service shutting down",
                extra={"service": settings.service_name})


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="HaCha AI Verification Service",
        description="AI microservice for evidence-grounded claim verification",
        version=settings.version,
        lifespan=lifespan,
        docs_url="/docs" if settings.environment == "development" else None,
        redoc_url="/redoc" if settings.environment == "development" else None,
    )

    # Include routers
    app.include_router(health.router, prefix="")
    app.include_router(verify.router, prefix="")

    # Global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request, exc):
        logger = get_logger(__name__)
        logger.exception("Unhandled exception", extra={"path": str(request.url)})
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.environment == "development",
        log_level=settings.log_level.lower(),
    )
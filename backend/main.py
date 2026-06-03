"""
OSE — Omni-System Executive
Institutional-grade AI agent orchestration system
"""

import os
import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.core.config import settings
from app.core.logger import logger
from app.core.validation import validate_environment
from app.api.server import create_app

def main():
    """Application entry point with full environment validation."""
    try:
        # Validate environment before starting
        logger.info("OSE — Starting Omni-System Executive")
        validate_environment()
        logger.info("✓ Environment validation passed")

        # Create and configure FastAPI application
        app = create_app()
        logger.info("✓ Application initialized")

        # Start server
        import uvicorn
        logger.info(f"Starting server on {settings.HOST}:{settings.PORT}")
        uvicorn.run(
            app,
            host=settings.HOST,
            port=settings.PORT,
            log_level=settings.LOG_LEVEL.lower(),
        )
    except Exception as e:
        logger.critical(f"Failed to start application: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()

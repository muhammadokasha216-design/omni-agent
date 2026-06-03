"""FastAPI application factory and route setup."""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.logger import logger
from app.db.database import init_db, close_db
from app.db.supabase_client import realtime_manager
from app.api import routes

class ConnectionManager:
    """Manages WebSocket connections for real-time updates."""

    def __init__(self):
        self.active_connections: dict = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"✓ Client connected: {client_id}")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"✗ Client disconnected: {client_id}")

    async def broadcast(self, message: dict):
        """Send message to all connected clients."""
        for client_id, connection in list(self.active_connections.items()):
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send to {client_id}: {e}")
                self.disconnect(client_id)

# Global connection manager
manager = ConnectionManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown."""
    # Startup
    try:
        await init_db()
        logger.info("OSE — Omni-System Executive started successfully")
    except Exception as e:
        logger.critical(f"Startup failed: {e}")
        raise

    yield

    # Shutdown
    realtime_manager.close_all()
    await close_db()
    logger.info("OSE — Application shutdown complete")

def create_app() -> FastAPI:
    """Create and configure FastAPI application."""

    app = FastAPI(
        title="OSE — Omni-System Executive",
        description="Institutional-grade AI agent orchestration dashboard",
        version="2.0.0",
        lifespan=lifespan,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(routes.health.router)
    app.include_router(routes.commands.router)
    app.include_router(routes.agents.router)
    app.include_router(routes.trading.router)
    app.include_router(routes.realtime.router)

    # Health check
    @app.get("/")
    async def root():
        return {
            "name": "OSE — Omni-System Executive",
            "version": "2.0.0",
            "status": "operational",
        }

    return app

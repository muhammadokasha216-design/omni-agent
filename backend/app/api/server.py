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
        
        # Initialize Telegram Bot and register Webhook automatically
        import os
        from app.services.telegram_bot import init_telegram_app, get_bot_token
        tg_token = await get_bot_token()
        if tg_token:
            from app.db.supabase_client import supabase
            url_res = supabase.table("app_settings").select("value").eq("key", "webhook_url").execute()
            webhook_url = url_res.data[0]["value"].strip() if url_res.data else os.getenv("WEBHOOK_URL", "")
            
            secret_res = supabase.table("app_settings").select("value").eq("key", "telegram_webhook_secret").execute()
            webhook_secret = secret_res.data[0]["value"].strip() if secret_res.data else "ARES_GUARD_TOKEN_99X"
            
            if webhook_url:
                from telegram import Bot
                bot = Bot(token=tg_token)
                webhook_target_url = f"{webhook_url}/webhook/telegram/{webhook_secret}"
                logger.info(f"📡 Setting Telegram Webhook target to: {webhook_target_url}")
                await bot.set_webhook(url=webhook_target_url, allowed_updates=["message", "callback_query"])
                
            # Initialize python-telegram-bot application context
            await init_telegram_app()
        
        if settings.ENABLE_MARKET_STREAMING:
            import asyncio
            from app.services.market_ingestion import run_binance_websocket
            app.state.binance_task = asyncio.create_task(run_binance_websocket())
            logger.info("✓ Binance WebSocket background ingestion engine initialized")
    except Exception as e:
        logger.critical(f"Startup failed: {e}")
        raise

    yield

    # Shutdown
    from app.services.telegram_bot import _telegram_app
    if _telegram_app is not None:
        logger.info("Stopping Telegram Bot Application...")
        await _telegram_app.stop()
        await _telegram_app.shutdown()

    if hasattr(app.state, "binance_task"):
        logger.info("Stopping Binance WebSocket background ingestion engine...")
        app.state.binance_task.cancel()
        try:
            await app.state.binance_task
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error shutting down Binance WebSocket ingestion: {e}")

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
    app.include_router(routes.telegram_webhook.router)

    # Health check
    @app.get("/")
    async def root():
        return {
            "name": "OSE — Omni-System Executive",
            "version": "2.0.0",
            "status": "operational",
        }

    return app

"""Telegram Webhook router."""

import hmac
from fastapi import APIRouter, Request, Header, HTTPException
from app.core.logger import logger
from app.db.supabase_client import supabase
from app.services.telegram_bot import init_telegram_app
from telegram import Update

router = APIRouter(prefix="/webhook", tags=["telegram"])

async def get_webhook_secret() -> str:
    """Retrieve expected webhook secret token from app_settings."""
    try:
        res = supabase.table("app_settings").select("value").eq("key", "telegram_webhook_secret").execute()
        return res.data[0]["value"].strip() if res.data and res.data[0]["value"] else ""
    except Exception as e:
        logger.error(f"Failed to fetch Telegram webhook secret from DB: {e}")
        return ""

@router.post("/telegram/{token}")
async def telegram_webhook(
    token: str,
    request: Request
):
    """
    FastAPI endpoint securely catching webhooks from Telegram.
    Enforces Zero-Trust path token validation.
    """
    expected_secret = await get_webhook_secret()
    
    if expected_secret:
        if token != expected_secret:
            logger.warning("🛡️ Blocked unauthorized Telegram Webhook request (URL token mismatch)")
            raise HTTPException(status_code=403, detail="Unauthorized Webhook Origin.")
    else:
        # Fallback to checking a default token
        if token != "ARES_GUARD_TOKEN_99X":
            logger.warning("🛡️ Blocked unauthorized Telegram Webhook request (default token mismatch)")
            raise HTTPException(status_code=403, detail="Unauthorized Webhook Origin.")
            
    # Parse the payload
    try:
        payload = await request.json()
        logger.debug(f"Received Telegram webhook update payload: {payload}")
        
        # Retrieve the global telegram app
        app = await init_telegram_app()
        if not app:
            logger.error("Telegram app not initialized. Drop update.")
            return {"status": "error", "message": "bot not initialized"}
            
        # Feed update to python-telegram-bot
        update = Update.de_json(payload, app.bot)
        await app.process_update(update)
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error processing Telegram webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))

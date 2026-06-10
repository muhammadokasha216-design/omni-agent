"""Market data ingestion service connected to Binance WebSocket."""

import asyncio
import json
import time
from collections import deque
from typing import Dict, Any, Optional, Tuple
import websockets
import httpx

from app.core.logger import logger
from app.db.supabase_client import supabase
from app.api.routes.realtime import broadcast_update

# Sliding window for BTC/USDT price ticks in the last 60 seconds
# Stores tuples of (timestamp_seconds, price)
price_window = deque()

# In-memory flag for trading halt to prevent database spam and Telegram alert rate-limiting
_in_memory_halted: bool = False

async def get_telegram_settings() -> Tuple[Optional[str], Optional[str]]:
    """Fetch Telegram bot credentials from database."""
    try:
        res = supabase.table("app_settings").select("key,value").in_("key", ["telegram_bot_token", "telegram_chat_id"]).execute()
        settings = {row["key"]: row["value"] for row in res.data} if res.data else {}
        return settings.get("telegram_bot_token"), settings.get("telegram_chat_id")
    except Exception as e:
        logger.error(f"Failed to fetch Telegram settings: {e}")
        return None, None

async def send_telegram_alert(bot_token: str, chat_id: str, current_price: float, max_price: float):
    """Send a structured Markdown emergency alert to the Owner and log it in the DB."""
    if not bot_token or not chat_id:
        logger.warning("Telegram bot credentials not configured in app_settings. Alert aborted.")
        return

    drop_percent = ((max_price - current_price) / max_price) * 100.0
    text = (
        "🚨 *ARES EMERGENCY ALERT: FLASH CRASH DETECTED* 🚨\n\n"
        "⚠️ *Status:* TRADING HALTED\n"
        "📉 *Symbol:* BTC/USDT\n"
        f"🔴 *Current Price:* `${current_price:,.2f}` USD\n"
        f"📈 *Peak Price (Last 60s):* `${max_price:,.2f}` USD\n"
        f"📉 *Price Drop:* `-{drop_percent:.2f}%`\n\n"
        "🛡️ *Action:* Zero-Trust protection triggered. All automated trading hooks are locked. Action requires Owner authorization."
    )

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown"
    }

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(url, json=payload, timeout=10.0)
            if res.status_code == 200:
                logger.info("✓ Emergency Telegram alert dispatched successfully")
                status = "processed"
                error_msg = None
            else:
                logger.error(f"✗ Failed to dispatch Telegram alert: {res.text}")
                status = "failed"
                error_msg = f"Telegram API returned {res.status_code}: {res.text}"
                
            # Log the message to database audit trail
            supabase.table("telegram_messages").insert({
                "direction": "outbound",
                "chat_id": chat_id,
                "message_text": text,
                "status": status,
                "error_msg": error_msg,
                "processed_at": "now()",
            }).execute()
    except Exception as e:
        logger.error(f"Error dispatching Telegram alert: {e}")

async def trigger_flash_crash_protocol(current_price: float, max_price: float):
    """Flip the db flag, dispatch Telegram notifications, and broadcast WebSocket alerts."""
    global _in_memory_halted
    _in_memory_halted = True
    
    logger.critical(
        f"🚨 FLASH CRASH DETECTED! Price dropped from {max_price:,.2f} to {current_price:,.2f} within 60s. "
        "Halting all trading activities."
    )
    
    try:
        # Flip the database flag
        supabase.table("app_settings").upsert({
            "key": "trading_halted",
            "value": "true",
            "label": "Trading Halted Status",
            "category": "general",
            "is_secret": False
        }).execute()
        logger.info("✓ Supabase trading_halted flag updated to true")
        
        # Load credentials and dispatch Telegram alert
        from app.services.telegram_bot import send_emergency_halt_notification
        await send_emergency_halt_notification(current_price, max_price)
            
        # Broadcast the halt state over WebSockets
        drop_percent = ((max_price - current_price) / max_price) * 100.0
        await broadcast_update("market", {
            "event": "trading_halted",
            "status": "halted",
            "reason": f"Price dropped -{drop_percent:.2f}% (from {max_price:,.2f} to {current_price:,.2f}) within 60 seconds."
        })
    except Exception as e:
        logger.error(f"Error executing Flash Crash halt protocol: {e}")

async def sync_halt_status_periodically():
    """Periodically check the database to sync the in-memory halt status with the database."""
    global _in_memory_halted
    while True:
        try:
            await asyncio.sleep(10.0)
            res = supabase.table("app_settings").select("value").eq("key", "trading_halted").execute()
            if res.data:
                db_halted = res.data[0]["value"].lower() == "true"
                if _in_memory_halted != db_halted:
                    _in_memory_halted = db_halted
                    logger.info(f"Synchronized in-memory halt status with DB: {db_halted}")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Failed to synchronize halt status: {e}")

async def process_binance_tick(data: Dict[str, Any]):
    """Process a single incoming price tick from the Binance stream."""
    try:
        # Event time 'E' in milliseconds, current close price 'c'
        event_time_ms = data.get("E", int(time.time() * 1000))
        event_time = event_time_ms / 1000.0
        price_str = data.get("c")
        if not price_str:
            return

        current_price = float(price_str)
        
        # Append current price to the sliding window
        price_window.append((event_time, current_price))
        
        # Prune elements older than 60 seconds
        cutoff = event_time - 60.0
        while price_window and price_window[0][0] < cutoff:
            price_window.popleft()
            
        # Check drop condition
        if len(price_window) > 1 and not _in_memory_halted:
            max_price = max(p for t, p in price_window)
            if current_price <= max_price * 0.98:
                await trigger_flash_crash_protocol(current_price, max_price)
                
        # Broadcast standard ticker updates to frontend clients
        await broadcast_update("market", {
            "event": "ticker",
            "symbol": "BTC/USDT",
            "price": current_price,
            "timestamp": event_time_ms
        })
        
    except Exception as e:
        logger.error(f"Error processing ticker update: {e}")

async def run_binance_websocket():
    """Connects to Binance WebSockets, processes stream ticks, and manages reconnections."""
    url = "wss://stream.binance.com:9443/ws/btcusdt@ticker"
    backoff = 1.0
    
    # Initialize the sync task in parallel
    sync_task = asyncio.create_task(sync_halt_status_periodically())
    
    try:
        # Initial status sync on launch
        res = supabase.table("app_settings").select("value").eq("key", "trading_halted").execute()
        if res.data:
            global _in_memory_halted
            _in_memory_halted = res.data[0]["value"].lower() == "true"
            logger.info(f"Initial in-memory halt status synchronized from DB: {_in_memory_halted}")
            
        while True:
            try:
                logger.info(f"Connecting to Binance WebSocket sensory array: {url}")
                async with websockets.connect(url) as websocket:
                    logger.info("✓ Connected to Binance WebSocket successfully")
                    backoff = 1.0  # Reset backoff on successful connection
                    
                    async for message in websocket:
                        data = json.loads(message)
                        await process_binance_tick(data)
                        
            except websockets.exceptions.ConnectionClosed:
                logger.warning("Binance WebSocket connection closed. Attempting reconnect...")
            except Exception as e:
                logger.error(f"Binance WebSocket ingestion error: {e}")
                
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2.0, 60.0)
    except asyncio.CancelledError:
        logger.info("Binance WebSocket sensory array task shutdown initiated.")
    finally:
        sync_task.cancel()
        try:
            await sync_task
        except asyncio.CancelledError:
            pass
        logger.info("Binance WebSocket sensory array task fully offline.")

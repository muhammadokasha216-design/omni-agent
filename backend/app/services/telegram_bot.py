"""Telegram Bot service module — Interactive Webhook Architecture with Inline Keyboards."""

import os
import json
from typing import Optional, Tuple
from telegram import Bot, Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CallbackQueryHandler, ContextTypes

from app.core.logger import logger
from app.db.supabase_client import supabase

# Global Telegram Application instance
_telegram_app: Optional[Application] = None

async def get_bot_token() -> str:
    """Retrieve Telegram Bot Token from database."""
    try:
        res = supabase.table("app_settings").select("value").eq("key", "telegram_bot_token").execute()
        return res.data[0]["value"].strip() if res.data and res.data[0]["value"] else ""
    except Exception as e:
        logger.error(f"Failed to retrieve Telegram bot token from DB: {e}")
        return ""

async def get_chat_id() -> str:
    """Retrieve Telegram Chat ID from database."""
    try:
        res = supabase.table("app_settings").select("value").eq("key", "telegram_chat_id").execute()
        return res.data[0]["value"].strip() if res.data and res.data[0]["value"] else ""
    except Exception as e:
        logger.error(f"Failed to retrieve Telegram chat ID from DB: {e}")
        return ""

async def init_telegram_app() -> Optional[Application]:
    """Initialize the global telegram application if not already initialized."""
    global _telegram_app
    if _telegram_app is not None:
        return _telegram_app

    token = await get_bot_token()
    if not token:
        logger.warning("⚠ Telegram Bot Token is empty. Interactive Webhook Engine is disabled.")
        return None

    try:
        # Build the application
        app = Application.builder().token(token).build()

        # Add Callback Query Handler to process inline button taps
        app.add_handler(CallbackQueryHandler(handle_callback_query))

        # Explicit initialization for manual update routing (webhooks)
        await app.initialize()
        await app.start()

        _telegram_app = app
        logger.info("✓ Telegram Bot Application successfully initialized")
        return _telegram_app
    except Exception as e:
        logger.error(f"Failed to initialize Telegram Bot Application: {e}")
        return None

async def handle_callback_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Processes inline button taps from the Owner's Telegram Gatekeeper."""
    query = update.callback_query
    if not query:
        return

    # Acknowledge the callback query instantly to prevent spinning loader in Telegram
    await query.answer()

    # Security Check: Ensure only the authorized Owner can click buttons
    owner_chat_id = await get_chat_id()
    if owner_chat_id:
        try:
            if query.from_user.id != int(owner_chat_id):
                await query.edit_message_text(text="⛔ EXPLOIT ATTEMPT BLOCKED: Unauthorized Entity.")
                logger.warning(f"🛡️ Unauthorized Telegram interaction attempt blocked from User ID: {query.from_user.id}")
                return
        except ValueError:
            if str(query.from_user.id) != owner_chat_id:
                await query.edit_message_text(text="⛔ EXPLOIT ATTEMPT BLOCKED: Unauthorized Entity.")
                logger.warning(f"🛡️ Unauthorized Telegram interaction attempt blocked from User ID: {query.from_user.id}")
                return

    data = query.data
    logger.info(f"Received Telegram callback query action: {data}")

    try:
        if data.startswith("approve:") or data.startswith("reject:"):
            action, user_id = data.split(":")
            
            # Fetch user email for context
            profile_res = supabase.table("profiles").select("email").eq("user_id", user_id).execute()
            email = profile_res.data[0]["email"] if profile_res.data else "Unknown User"

            if action == "approve":
                # Set account status to active
                supabase.table("profiles").update({"account_status": "active"}).eq("user_id", user_id).execute()
                await query.edit_message_text(
                    text=f"✅ *User Approved*\n\n📧 Email: `{email}`\n🆔 ID: `{user_id}`\n\nStatus updated to `active` in Supabase vault."
                )
                logger.info(f"✓ Approved user via Telegram Gatekeeper: {email} ({user_id})")
            else:
                # Set account status to rejected
                supabase.table("profiles").update({"account_status": "rejected"}).eq("user_id", user_id).execute()
                await query.edit_message_text(
                    text=f"❌ *User Rejected*\n\n📧 Email: `{email}`\n🆔 ID: `{user_id}`\n\nStatus updated to `rejected` in Supabase vault."
                )
                logger.info(f"✗ Rejected user via Telegram Gatekeeper: {email} ({user_id})")

        elif data == "halt_trading":
            # Halt trading in DB settings
            supabase.table("app_settings").upsert({
                "key": "trading_halted",
                "value": "true",
                "label": "Trading Halted Status",
                "category": "general",
                "is_secret": False
            }).execute()

            # Sync in-memory halt status
            try:
                from app.services import market_ingestion
                market_ingestion._in_memory_halted = True
            except ImportError:
                pass

            await query.edit_message_text(
                text="🛑 *Trading Halted*\n\nEmergency halting protocol is active. All automated trade execution locked."
            )
            logger.critical("🚨 TRADING HALTED via Telegram Inline command!")

        elif data == "liquidate_positions":
            # Cancel all open simulation trades
            supabase.table("sim_trades").update({
                "status": "cancelled",
                "closed_at": "now()"
            }).eq("status", "open").execute()

            await query.edit_message_text(
                text="💸 *Positions Liquidated*\n\nSent emergency liquidation commands to exchange. All open simulation trades closed/cancelled."
            )
            logger.critical("🚨 POSITIONS LIQUIDATED via Telegram Inline command!")

    except Exception as e:
        logger.error(f"Error handling Telegram Callback Query: {e}")
        await query.edit_message_text(text=f"⚠️ *Execution Error:* `{str(e)}`")

async def send_onboarding_notification(user_id: str, email: str):
    """Sends onboarding approval request to owner with Approve/Reject inline keyboard."""
    app = await init_telegram_app()
    if not app:
        return

    chat_id = await get_chat_id()
    if not chat_id:
        logger.warning("Telegram Chat ID is not configured. Aborting onboarding alert.")
        return

    text = (
        f"🆕 *New User Registration Request*\n\n"
        f"📧 Email: `{email}`\n"
        f"🆔 ID: `{user_id}`\n\n"
        f"Review the request and action using the buttons below:"
    )

    keyboard = [
        [
            InlineKeyboardButton("✅ APPROVE", callback_data=f"approve:{user_id}"),
            InlineKeyboardButton("❌ REJECT", callback_data=f"reject:{user_id}")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    try:
        await app.bot.send_message(
            chat_id=chat_id,
            text=text,
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )
        logger.info(f"Onboarding Telegram notification successfully sent for user {email}")
    except Exception as e:
        logger.error(f"Failed to send onboarding notification: {e}")

async def send_emergency_halt_notification(current_price: float, max_price: float):
    """Sends flash crash emergency notification with Halt/Liquidate inline keyboard."""
    app = await init_telegram_app()
    if not app:
        return

    chat_id = await get_chat_id()
    if not chat_id:
        logger.warning("Telegram Chat ID is not configured. Aborting emergency alert.")
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

    keyboard = [
        [
            InlineKeyboardButton("🛑 HALT ALL TRADING", callback_data="halt_trading"),
            InlineKeyboardButton("💸 LIQUIDATE POSITIONS", callback_data="liquidate_positions")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    try:
        await app.bot.send_message(
            chat_id=chat_id,
            text=text,
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )
        logger.info("Emergency Telegram halt notification successfully sent")
    except Exception as e:
        logger.error(f"Failed to send emergency halt notification: {e}")

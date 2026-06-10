"""Trading endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.logger import logger
from app.db.supabase_client import supabase

router = APIRouter(prefix="/api/trading", tags=["trading"])

class TradingHookRequest(BaseModel):
    """Trading hook configuration."""
    label: str
    symbol: str
    action: str
    quantity: float

@router.get("/hooks")
async def get_trading_hooks():
    """Get all trading hooks."""
    try:
        result = supabase.table("trading_hooks").select("*").execute()
        return {"hooks": result.data or []}
    except Exception as e:
        logger.error(f"Hooks retrieval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/hooks")
async def create_trading_hook(request: TradingHookRequest):
    """Create a new trading hook."""
    try:
        result = supabase.table("trading_hooks").insert({
            "label": request.label,
            "symbol": request.symbol,
            "action": request.action,
            "quantity": request.quantity,
            "is_active": False,
        }).execute()

        return {"hook": result.data[0] if result.data else None}
    except Exception as e:
        logger.error(f"Hook creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/hooks/{hook_id}/execute")
async def execute_trading_hook(hook_id: str):
    """Execute a trading hook."""
    try:
        # Check if trading is halted (check in-memory cache first, fallback to DB)
        from app.services.market_ingestion import _in_memory_halted
        is_halted = _in_memory_halted
        
        if not is_halted:
            halt_check = supabase.table("app_settings").select("value").eq("key", "trading_halted").execute()
            if halt_check.data and halt_check.data[0]["value"].lower() == "true":
                is_halted = True
                
        if is_halted:
            logger.warning("⛔ Execution Blocked: Automated trading is HALTED due to active Flash Crash protocol.")
            raise HTTPException(
                status_code=403,
                detail="[ARES] Execution Blocked: Automated trading is HALTED due to active Flash Crash protocol."
            )

        # Get hook details
        hook_result = supabase.table("trading_hooks").select("*").eq("id", hook_id).single().execute()
        hook = hook_result.data

        logger.info(f"Executing hook: {hook['label']}")

        # Update last_executed timestamp
        supabase.table("trading_hooks").update({
            "last_executed": "now()",
        }).eq("id", hook_id).execute()

        return {
            "status": "executed",
            "hook": hook,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Hook execution error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

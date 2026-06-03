"""Command processing endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.logger import logger
from app.db.supabase_client import supabase

router = APIRouter(prefix="/api/commands", tags=["commands"])

class CommandRequest(BaseModel):
    """Command execution request."""
    input: str
    context: dict = {}

class CommandResponse(BaseModel):
    """Command execution response."""
    command_id: str
    status: str
    result: dict

@router.post("/execute", response_model=CommandResponse)
async def execute_command(request: CommandRequest):
    """Execute a command through the OSE."""
    try:
        logger.info(f"Executing command: {request.input[:50]}...")

        # Insert command into database
        result = supabase.table("command_history").insert({
            "raw_input": request.input,
            "parsed_intent": request.input,
            "payload": request.context,
            "status": "pending",
        }).execute()

        command_id = result.data[0]["id"] if result.data else None

        return CommandResponse(
            command_id=command_id,
            status="accepted",
            result={"message": "Command queued for processing"},
        )

    except Exception as e:
        logger.error(f"Command execution error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
async def get_command_history(limit: int = 10):
    """Get recent command history."""
    try:
        result = supabase.table("command_history").select("*").order(
            "created_at", desc=True
        ).limit(limit).execute()
        return {"commands": result.data or []}
    except Exception as e:
        logger.error(f"History retrieval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

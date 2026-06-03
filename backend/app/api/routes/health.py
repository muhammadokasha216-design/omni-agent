"""Health check endpoints."""

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/health", tags=["health"])

@router.get("/")
async def health_check():
    """Check application health."""
    return {
        "status": "healthy",
        "service": "OSE",
    }

@router.get("/db")
async def database_health():
    """Check database connectivity."""
    try:
        from app.db.database import engine
        async with engine.begin() as conn:
            await conn.execute("SELECT 1")
        return {"database": "healthy"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database error: {e}")

@router.get("/agents")
async def agents_health():
    """Check agent orchestration status."""
    try:
        from app.services.agent_orchestration import agent_brain
        return {
            "agents": "operational",
            "count": len(agent_brain.agents),
            "agents_list": [agent.config.name for agent in agent_brain.agents.values()],
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Agent error: {e}")

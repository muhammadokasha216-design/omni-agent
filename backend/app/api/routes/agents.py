"""Agent orchestration endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.logger import logger
from app.services.agent_orchestration import agent_brain, AgentRole

router = APIRouter(prefix="/api/agents", tags=["agents"])

class MarketDataRequest(BaseModel):
    """Market data for analysis."""
    symbol: str
    price: float
    volume: float
    trend: str

@router.get("/status")
async def get_agent_status():
    """Get status of all agents."""
    return {
        "agents": [
            {
                "role": agent.config.role.value,
                "name": agent.config.name,
                "model": agent.config.model,
                "status": "operational",
            }
            for agent in agent_brain.agents.values()
        ],
        "total_agents": len(agent_brain.agents),
    }

@router.post("/analyze")
async def analyze_market(request: MarketDataRequest):
    """Run agent analysis on market data."""
    try:
        logger.info(f"Analyzing {request.symbol} at ${request.price}")

        # Execute decision pipeline
        result = await agent_brain.execute_decision_pipeline({
            "symbol": request.symbol,
            "price": request.price,
            "volume": request.volume,
            "trend": request.trend,
        })

        return result

    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/agent/{agent_role}/prompt")
async def send_prompt_to_agent(agent_role: str, prompt: str):
    """Send a custom prompt to a specific agent."""
    try:
        role = AgentRole(agent_role)
        agent = agent_brain.agents.get(role)

        if not agent:
            raise ValueError(f"Agent role {agent_role} not found")

        response = await agent.analyze(prompt)
        return {"agent": agent.config.name, "response": response}

    except Exception as e:
        logger.error(f"Agent prompt error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

"""Agent Orchestration Brain — coordinates multiple AI agents."""

from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from enum import Enum
import asyncio
from app.core.logger import logger
import anthropic

class AgentRole(Enum):
    """Predefined AI agent roles."""
    MARKET_ANALYST = "market_analyst"
    RISK_MANAGER = "risk_manager"
    EXECUTION_ENGINE = "execution_engine"
    STRATEGIC_ADVISOR = "strategic_advisor"
    USER_ONBOARDING = "user_onboarding"

@dataclass
class AgentConfig:
    """Configuration for an AI agent."""
    role: AgentRole
    name: str
    system_prompt: str
    model: str = "claude-3-5-sonnet-20241022"

class AIAgent:
    """Individual AI agent with specialized role."""

    def __init__(self, config: AgentConfig):
        self.config = config
        self.client = anthropic.Anthropic()
        self.conversation_history: List[Dict[str, str]] = []

    async def analyze(self, input_text: str) -> str:
        """Process input and return analysis."""
        try:
            self.conversation_history.append({"role": "user", "content": input_text})

            response = self.client.messages.create(
                model=self.config.model,
                max_tokens=1024,
                system=self.config.system_prompt,
                messages=self.conversation_history,
            )

            analysis = response.content[0].text
            self.conversation_history.append({"role": "assistant", "content": analysis})

            logger.debug(f"Agent {self.config.name} analysis complete")
            return analysis
        except Exception as e:
            logger.error(f"Agent {self.config.name} error: {e}")
            raise

class OmniAgentBrain:
    """Orchestrates multiple AI agents for decision-making."""

    def __init__(self):
        self.agents: Dict[AgentRole, AIAgent] = {}
        self._initialize_agents()

    def _initialize_agents(self):
        """Create and initialize all agent roles."""
        configs = [
            AgentConfig(
                role=AgentRole.MARKET_ANALYST,
                name="Market Analyst",
                system_prompt="""You are a professional market analyst. Analyze market conditions, trends,
                price movements, and identify trading opportunities. Provide data-driven insights.""",
            ),
            AgentConfig(
                role=AgentRole.RISK_MANAGER,
                name="Risk Manager",
                system_prompt="""You are a risk management expert. Evaluate trade risks, position sizing,
                stop-loss levels, and portfolio exposure. Prioritize capital preservation.""",
            ),
            AgentConfig(
                role=AgentRole.EXECUTION_ENGINE,
                name="Execution Engine",
                system_prompt="""You are a trade execution specialist. Given approved trades and risk parameters,
                generate precise execution instructions with optimal timing and entry/exit points.""",
            ),
            AgentConfig(
                role=AgentRole.STRATEGIC_ADVISOR,
                name="Strategic Advisor",
                system_prompt="""You are a strategic advisor. Synthesize inputs from other agents, provide
                high-level recommendations, and ensure overall portfolio alignment with goals.""",
            ),
            AgentConfig(
                role=AgentRole.USER_ONBOARDING,
                name="User Onboarding Specialist",
                system_prompt="""You are a user onboarding specialist for the ARES system. 
                When a new user signs up, your job is to generate a concise, engaging, and professional 
                notification message for the system administrators to be sent via Telegram. 
                Always include the exact commands to approve or reject the user: /approve [ID] and /reject [ID].""",
            ),
        ]

        for config in configs:
            self.agents[config.role] = AIAgent(config)
            logger.info(f"✓ Initialized agent: {config.name}")

    async def execute_decision_pipeline(self, market_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the full decision pipeline:
        1. Market Analysis
        2. Risk Assessment
        3. Execution Planning
        4. Strategic Review
        """
        try:
            logger.info("Starting agent decision pipeline...")

            # Stage 1: Market Analysis
            market_analysis = await self.agents[AgentRole.MARKET_ANALYST].analyze(
                f"Analyze this market data and identify opportunities:\n{market_data}"
            )
            logger.debug(f"Market Analysis: {market_analysis[:100]}...")

            # Stage 2: Risk Assessment
            risk_assessment = await self.agents[AgentRole.RISK_MANAGER].analyze(
                f"Based on this market analysis, identify risks and constraints:\n{market_analysis}"
            )
            logger.debug(f"Risk Assessment: {risk_assessment[:100]}...")

            # Stage 3: Execution Planning
            execution_plan = await self.agents[AgentRole.EXECUTION_ENGINE].analyze(
                f"Create execution plan based on analysis and risk constraints:\nAnalysis: {market_analysis}\nRisks: {risk_assessment}"
            )
            logger.debug(f"Execution Plan: {execution_plan[:100]}...")

            # Stage 4: Strategic Review
            final_decision = await self.agents[AgentRole.STRATEGIC_ADVISOR].analyze(
                f"Review and finalize this decision:\nExecution Plan: {execution_plan}\nMarket Analysis: {market_analysis}"
            )

            logger.info("Agent decision pipeline complete")

            return {
                "market_analysis": market_analysis,
                "risk_assessment": risk_assessment,
                "execution_plan": execution_plan,
                "final_decision": final_decision,
                "status": "approved",
            }

        except Exception as e:
            logger.error(f"Decision pipeline error: {e}")
            return {"status": "error", "error": str(e)}

# Global brain instance
agent_brain = OmniAgentBrain()

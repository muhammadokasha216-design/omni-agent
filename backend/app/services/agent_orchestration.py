"""Agent Orchestration Brain — coordinates multiple AI agents."""

from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from enum import Enum
import asyncio
import httpx
from app.core.logger import logger
from app.core.config import settings
from app.db.supabase_client import supabase

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
        self.conversation_history: List[Dict[str, str]] = []

    async def _get_embedding(self, text: str) -> List[float]:
        """Generate vector embedding using Ollama nomic-embed-text."""
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    f"{settings.OLLAMA_URL}/api/embeddings",
                    json={
                        "model": settings.OLLAMA_EMBEDDING_MODEL,
                        "prompt": text
                    },
                    timeout=30.0
                )
                res.raise_for_status()
                return res.json()["embedding"]
        except Exception as e:
            logger.error(f"Failed to generate embedding for agent {self.config.name}: {e}")
            # Fallback embedding (768 zeros for nomic-embed-text)
            return [0.0] * 768

    async def _retrieve_past_context(self, input_text: str) -> str:
        """Search Supabase vector database for relevant past memories."""
        try:
            # Query embeddings for search
            embedding = await self._get_embedding(input_text)
            
            # Execute RPC function in Supabase
            res = supabase.rpc(
                "match_agent_memories",
                {
                    "query_embedding": embedding,
                    "match_threshold": 0.3,
                    "match_count": 3,
                    "filter_role": self.config.role.value
                }
            ).execute()
            
            if res.data:
                context_blocks = []
                for row in res.data:
                    context_blocks.append(
                        f"[Past Memory - {row.get('created_at', 'unknown')}]\n"
                        f"Summary: {row.get('summary')}\n"
                        f"Interaction: {row.get('content')}"
                    )
                logger.info(f"✓ Retrieved {len(res.data)} relevant memories for agent {self.config.name}")
                return "\n---\n".join(context_blocks)
        except Exception as e:
            logger.error(f"Error querying semantic memory in Supabase: {e}")
        return ""

    async def _summarize(self, text: str) -> str:
        """Use Ollama model to generate a concise summary of an interaction."""
        try:
            prompt = f"Summarize the following interaction between user and AI agent in one concise sentence:\n{text}"
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    f"{settings.OLLAMA_URL}/api/chat",
                    json={
                        "model": settings.OLLAMA_MODEL,
                        "messages": [
                            {
                                "role": "system", 
                                "content": "You are a professional log consolidator. Respond with exactly one brief, concise sentence summarizing the core decision, status, or insight."
                            },
                            {"role": "user", "content": prompt}
                        ],
                        "stream": False
                    },
                    timeout=30.0
                )
                res.raise_for_status()
                return res.json()["message"]["content"].strip()
        except Exception as e:
            logger.error(f"Ollama summarization error: {e}")
            return text[:100] + "..."

    async def _persist_interaction_memory(self, user_text: str, assistant_text: str):
        """Persist conversation exchange to Supabase vector memory."""
        try:
            full_interaction = f"User: {user_text}\nAssistant: {assistant_text}"
            
            # Generate summary and embedding
            summary = await self._summarize(full_interaction)
            embedding = await self._get_embedding(summary)
            
            # Insert record in Supabase
            supabase.table("agent_memory").insert({
                "agent_role": self.config.role.value,
                "content": full_interaction,
                "summary": summary,
                "embedding": embedding
            }).execute()
            logger.debug(f"✓ Long-term memory saved in Supabase for agent {self.config.name}")
        except Exception as e:
            logger.error(f"Failed to persist memory for agent {self.config.name}: {e}")

    async def _check_and_compress_memory(self):
        """Monitor history token/character length. If threshold is exceeded, compress and flush."""
        total_chars = sum(len(m["content"]) for m in self.conversation_history)
        if len(self.conversation_history) > 10 or total_chars > 6000:
            logger.info(f"Compacting memory for agent {self.config.name} (Turns: {len(self.conversation_history)}, Chars: {total_chars})")
            
            # Compile conversation history string
            history_str = "\n".join(
                f"{m['role'].capitalize()}: {m['content']}" 
                for m in self.conversation_history
            )
            
            # Generate a summary of the whole history thread
            overall_summary = await self._summarize(f"Full conversation history:\n{history_str}")
            embedding = await self._get_embedding(overall_summary)
            
            # Save consolidated history as a long-term memory record
            try:
                supabase.table("agent_memory").insert({
                    "agent_role": self.config.role.value,
                    "content": f"Consolidated Conversation History:\n{history_str}",
                    "summary": f"Consolidated Summary: {overall_summary}",
                    "embedding": embedding
                }).execute()
                logger.info(f"✓ Saved consolidated conversation history to Supabase pgvector")
            except Exception as e:
                logger.error(f"Failed to save consolidated memory for {self.config.name}: {e}")
            
            # Keep only the latest assistant response as the short-term start context, flushing the rest
            latest_assistant = None
            for msg in reversed(self.conversation_history):
                if msg["role"] == "assistant":
                    latest_assistant = msg
                    break
            
            self.conversation_history.clear()
            if latest_assistant:
                self.conversation_history.append(latest_assistant)

    async def analyze(self, input_text: str) -> str:
        """Process input, integrate vector memory, run local Ollama inference, and persist."""
        try:
            # 1. Check and compress memory if context window is getting full
            await self._check_and_compress_memory()

            # 2. Retrieve past context from vector store
            retrieved_context = await self._retrieve_past_context(input_text)
            
            # 3. Formulate input prompt with context
            ollama_input = input_text
            if retrieved_context:
                ollama_input = f"{retrieved_context}\n\nCurrent Task/Question:\n{input_text}"

            # 4. Append to local conversation history
            self.conversation_history.append({"role": "user", "content": ollama_input})

            # 5. Build system & message payloads
            messages = [{"role": "system", "content": self.config.system_prompt}]
            messages.extend(self.conversation_history)

            # 6. Query local Ollama chat completions
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{settings.OLLAMA_URL}/api/chat",
                    json={
                        "model": settings.OLLAMA_MODEL,
                        "messages": messages,
                        "stream": False
                    },
                    timeout=60.0
                )
                response.raise_for_status()
                res_data = response.json()
                analysis = res_data["message"]["content"]

            # 7. Append assistant response to history
            self.conversation_history.append({"role": "assistant", "content": analysis})
            logger.debug(f"Agent {self.config.name} analysis complete via local Ollama")

            # 8. Asynchronously persist the interaction to the long-term vector store
            asyncio.create_task(self._persist_interaction_memory(input_text, analysis))

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

    async def _persist_market_data_memory(self, market_data: Dict[str, Any]):
        """Persist a summary and embedding of the incoming market data point to Supabase pgvector."""
        try:
            symbol = market_data.get("symbol", "Unknown")
            price = market_data.get("price", 0.0)
            volume = market_data.get("volume", 0.0)
            trend = market_data.get("trend", "stable")
            
            summary = f"Market data tick for {symbol}: Price={price}, Volume={volume}, Trend={trend}"
            content_str = f"Raw Market Feed Update:\n{market_data}"
            
            # Use the Market Analyst agent to generate embeddings for similarity search consistency
            market_agent = self.agents.get(AgentRole.MARKET_ANALYST)
            if market_agent:
                embedding = await market_agent._get_embedding(summary)
                supabase.table("agent_memory").insert({
                    "agent_role": "market_data",
                    "content": content_str,
                    "summary": summary,
                    "embedding": embedding
                }).execute()
                logger.info(f"✓ Persisted market data point memory to Supabase")
        except Exception as e:
            logger.error(f"Failed to persist market data point: {e}")

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
            
            # Persist the incoming market data point in the background
            asyncio.create_task(self._persist_market_data_memory(market_data))

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

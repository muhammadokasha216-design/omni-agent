"""Real-time streaming endpoints."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.logger import logger
import json

router = APIRouter(prefix="/api/realtime", tags=["realtime"])

# Store WebSocket connections
connections: dict = {}

@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time updates."""
    try:
        await websocket.accept()
        connections[client_id] = websocket
        logger.info(f"WebSocket client connected: {client_id}")

        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            # Subscribe to updates
            if message.get("action") == "subscribe":
                topic = message.get("topic")
                logger.info(f"Client {client_id} subscribing to {topic}")

                # Send confirmation
                await websocket.send_json({
                    "action": "subscribed",
                    "topic": topic,
                    "status": "ok",
                })

    except WebSocketDisconnect:
        if client_id in connections:
            del connections[client_id]
        logger.info(f"WebSocket client disconnected: {client_id}")

    except Exception as e:
        logger.error(f"WebSocket error: {e}")

@router.get("/topics")
async def get_available_topics():
    """Get list of available real-time topics."""
    return {
        "topics": [
            {"name": "commands", "description": "Command execution updates"},
            {"name": "agents", "description": "Agent status updates"},
            {"name": "trades", "description": "Trading hook executions"},
            {"name": "market", "description": "Market data updates"},
        ]
    }

async def broadcast_update(topic: str, data: dict):
    """Broadcast update to all connected clients subscribed to topic."""
    disconnected = []

    for client_id, connection in list(connections.items()):
        try:
            await connection.send_json({
                "topic": topic,
                "data": data,
            })
        except Exception as e:
            logger.error(f"Failed to send to {client_id}: {e}")
            disconnected.append(client_id)

    for client_id in disconnected:
        del connections[client_id]

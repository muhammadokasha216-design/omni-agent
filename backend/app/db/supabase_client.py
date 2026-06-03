"""Supabase client initialization and real-time management."""

from supabase import create_client, Client
from app.core.config import settings
from app.core.logger import logger

# Initialize Supabase client
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

class RealtimeManager:
    """Manages Supabase real-time connections and event streaming."""

    def __init__(self):
        self.channels = {}
        self.listeners = {}

    def subscribe_to_table(self, table_name: str, callback, event_type: str = "*"):
        """
        Subscribe to real-time updates on a table.

        Args:
            table_name: Table to subscribe to
            callback: Async function to call on events
            event_type: "INSERT", "UPDATE", "DELETE", or "*"
        """
        try:
            channel = supabase.realtime.channel(f"{table_name}:{event_type}")
            channel.on(event_type, callback).subscribe()
            self.channels[f"{table_name}:{event_type}"] = channel
            logger.info(f"✓ Real-time subscription: {table_name} ({event_type})")
        except Exception as e:
            logger.error(f"Failed to subscribe to {table_name}: {e}")
            raise

    def unsubscribe(self, table_name: str, event_type: str = "*"):
        """Unsubscribe from real-time updates."""
        channel_key = f"{table_name}:{event_type}"
        if channel_key in self.channels:
            supabase.realtime.unsubscribe(self.channels[channel_key])
            del self.channels[channel_key]
            logger.info(f"✓ Unsubscribed from {table_name}")

    def close_all(self):
        """Close all real-time connections."""
        for channel_key in list(self.channels.keys()):
            channel = self.channels.pop(channel_key)
            supabase.realtime.unsubscribe(channel)
        logger.info("✓ All real-time connections closed")

# Global instance
realtime_manager = RealtimeManager()

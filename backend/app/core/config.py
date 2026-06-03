"""Core configuration and settings management."""

import os
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    """Application settings with validation."""

    # API Configuration
    HOST: str = Field(default="0.0.0.0", description="API host")
    PORT: int = Field(default=8000, description="API port")
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")
    DEBUG: bool = Field(default=False, description="Debug mode")

    # Supabase Configuration
    SUPABASE_URL: str = Field(..., description="Supabase project URL")
    SUPABASE_ANON_KEY: str = Field(..., description="Supabase anonymous key")
    SUPABASE_SERVICE_KEY: str = Field(..., description="Supabase service role key")

    # Database Configuration
    DATABASE_URL: Optional[str] = Field(default=None, description="Direct database URL (if not using Supabase)")
    DB_POOL_SIZE: int = Field(default=20, description="Database connection pool size")
    DB_MAX_OVERFLOW: int = Field(default=10, description="Database connection pool overflow")
    DB_POOL_TIMEOUT: int = Field(default=30, description="Database connection timeout in seconds")
    DB_ECHO: bool = Field(default=False, description="Echo SQL queries")

    # AI Configuration
    ANTHROPIC_API_KEY: str = Field(..., description="Anthropic API key for Claude")
    ANTHROPIC_MODEL: str = Field(default="claude-3-5-sonnet-20241022", description="Claude model to use")

    # Security
    API_KEY_SECRET: str = Field(..., description="Secret key for API authentication")
    SESSION_TIMEOUT: int = Field(default=3600, description="Session timeout in seconds")
    CORS_ORIGINS: list = Field(default=["*"], description="CORS allowed origins")

    # Feature Flags
    ENABLE_REALTIME: bool = Field(default=True, description="Enable Supabase real-time")
    ENABLE_AGENT_ORCHESTRATION: bool = Field(default=True, description="Enable agent orchestration")
    ENABLE_MARKET_STREAMING: bool = Field(default=True, description="Enable market data streaming")

    class Config:
        env_file = ".env"
        case_sensitive = True

# Load settings from environment
settings = Settings()

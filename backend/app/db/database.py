"""Database module with advanced connection pooling."""

from typing import Optional, AsyncGenerator
from sqlalchemy import create_engine, event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import QueuePool, StaticPool
from app.core.config import settings
from app.core.logger import logger

# Build database URL
def get_database_url() -> str:
    """Construct database URL from Supabase or direct connection."""
    if settings.DATABASE_URL:
        return settings.DATABASE_URL
    # Supabase uses PostgreSQL, construct from environment
    return f"postgresql+asyncpg://{settings.SUPABASE_SERVICE_KEY}@db.{settings.SUPABASE_URL.split('//')[1].split('.')[0]}.internal:5432/postgres"

# Create async engine with connection pooling
engine = create_async_engine(
    get_database_url(),
    echo=settings.DB_ECHO,
    poolclass=QueuePool,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT,
    pool_pre_ping=True,  # Test connections before using
    pool_recycle=3600,   # Recycle connections after 1 hour
)

# Create session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting a database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            logger.error(f"Database session error: {e}")
            await session.rollback()
            raise
        finally:
            await session.close()

async def init_db():
    """Initialize database connection and test connectivity."""
    try:
        async with engine.begin() as conn:
            # Test connection
            await conn.execute("SELECT 1")
        logger.info("✓ Database connection pool initialized")
    except Exception as e:
        logger.critical(f"Failed to initialize database: {e}")
        raise

async def close_db():
    """Close database connections."""
    await engine.dispose()
    logger.info("✓ Database connections closed")

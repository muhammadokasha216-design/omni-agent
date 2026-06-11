"""Environment validation and security checks."""

import os
import sys
from typing import List
from app.core.logger import logger

REQUIRED_KEYS = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_KEY",
    "API_KEY_SECRET",
]

SENSITIVE_KEYS = [
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_KEY",
    "ANTHROPIC_API_KEY",
    "API_KEY_SECRET",
]

def validate_environment() -> None:
    """
    Validate that all required environment variables are present.
    Prevents the app from starting if critical keys are missing.
    """
    missing_keys: List[str] = []
    leaked_keys: List[str] = []

    for key in REQUIRED_KEYS:
        value = os.getenv(key)
        if not value:
            missing_keys.append(key)
            logger.error(f"✗ Missing required environment variable: {key}")
        elif key in SENSITIVE_KEYS:
            # Check for common test/placeholder values that indicate a leak/mistake
            if any(placeholder in value for placeholder in ["test", "demo", "placeholder", "xxx", "123"]):
                if not os.getenv("ALLOW_TEST_CREDENTIALS"):
                    leaked_keys.append(key)
                    logger.warning(f"⚠ Detected placeholder value in {key}. This looks like test data.")

    if missing_keys:
        logger.critical(f"Cannot start: missing {len(missing_keys)} required environment variables")
        for key in missing_keys:
            logger.critical(f"  - {key}")
        raise EnvironmentError(f"Missing required environment variables: {', '.join(missing_keys)}")

    if leaked_keys and not os.getenv("ALLOW_TEST_CREDENTIALS"):
        logger.critical(f"Cannot start: {len(leaked_keys)} environment variables contain placeholder values")
        logger.critical("This may indicate leaked or test credentials. Refusing to start for security.")
        raise EnvironmentError("Potential security risk: placeholder values in sensitive keys")

    logger.info("✓ All required environment variables present and valid")

def mask_key(key: str, show_chars: int = 4) -> str:
    """Mask sensitive keys for logging."""
    if len(key) <= show_chars:
        return "*" * len(key)
    return key[:show_chars] + "*" * (len(key) - show_chars)

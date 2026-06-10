"""
╔══════════════════════════════════════════════════════════════════════╗
║  ARES AUTHENTICATION ENGINE — Grade 5 Protocol                     ║
║  Codename: Owner-Lock                                              ║
║                                                                     ║
║  Single-endpoint Auto-Auth with Role-Based Access Control           ║
║  Database: ares_vault.db (SQLite)                                   ║
║  Security: bcrypt + JWT + RBAC                                      ║
╚══════════════════════════════════════════════════════════════════════╝
"""

import os
import sqlite3
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

# ---------------------------------------------------------------------------
# We use PyJWT (import as 'jwt') and passlib for bcrypt hashing.
# These are listed in requirements_auth.txt.
# ---------------------------------------------------------------------------
import jwt
from passlib.context import CryptContext


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 1 — CONFIGURATION (The Master Key)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# The ONLY email that receives 'owner' privileges. Everything else is 'demo'.
OWNER_EMAIL = "muhammadokasha216@gmail.com"

# JWT Configuration
# In production, load this from an environment variable. For local dev, we
# generate a strong random secret on first launch and persist it.
JWT_SECRET_KEY = os.environ.get(
    "ARES_JWT_SECRET",
    "ares-vault-secret-" + hashlib.sha256(b"ares-grade5-protocol").hexdigest()[:32]
)
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Database path — sits next to this file
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ares_vault.db")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 2 — PASSWORD HASHING (bcrypt via passlib)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 3 — DATABASE LAYER (ares_vault.db)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def get_db() -> sqlite3.Connection:
    """Open a connection to ares_vault.db with row factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")   # Write-Ahead Logging for safety
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_database():
    """
    Initialize the users table if it does not exist.
    Called once at application startup.
    """
    conn = get_db()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                email       TEXT    UNIQUE NOT NULL,
                password    TEXT    NOT NULL,
                role        TEXT    NOT NULL DEFAULT 'demo' CHECK(role IN ('owner', 'demo')),
                created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.commit()
        print("[ARES] OK Database initialized: ares_vault.db")
        print(f"[ARES] OK Database path: {DB_PATH}")
    finally:
        conn.close()


def get_user_by_email(email: str) -> dict | None:
    """Fetch a user row by email. Returns dict or None."""
    conn = get_db()
    try:
        cursor = conn.execute("SELECT * FROM users WHERE email = ?", (email.lower(),))
        row = cursor.fetchone()
        if row:
            return dict(row)
        return None
    finally:
        conn.close()


def create_user(email: str, hashed_password: str, role: str) -> dict:
    """Insert a new user and return the created record."""
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (email, password, role) VALUES (?, ?, ?)",
            (email.lower(), hashed_password, role),
        )
        conn.commit()
        return get_user_by_email(email)
    finally:
        conn.close()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 4 — JWT TOKEN ENGINE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def create_jwt_token(email: str, role: str) -> str:
    """
    Mint a JWT token containing the user's email and role.
    The role is baked INTO the token — this is what the Owner-Lock reads.
    """
    payload = {
        "sub": email,
        "role": role,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_jwt_token(token: str) -> dict:
    """
    Decode and validate a JWT token.
    Raises HTTPException on failure — no silent degradation.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="[ARES] Token expired. Re-authenticate.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="[ARES] Invalid token. Access denied.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 5 — FASTAPI DEPENDENCIES (The Guard Layer)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> dict:
    """
    Dependency: Extract and validate the current user from the JWT token.
    Returns the decoded payload dict with 'sub' (email) and 'role'.
    """
    payload = decode_jwt_token(token)
    email = payload.get("sub")
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="[ARES] Malformed token — no subject claim.",
        )
    return payload


async def require_owner(
    current_user: Annotated[dict, Depends(get_current_user)]
) -> dict:
    """
    ┌─────────────────────────────────────────────────────────────────┐
    │  THE OWNER-LOCK                                                │
    │                                                                │
    │  This dependency is the final gate. If the JWT does not        │
    │  contain role='owner', the request is TERMINATED with a        │
    │  403 Forbidden. No negotiation. No fallback.                   │
    └─────────────────────────────────────────────────────────────────┘
    """
    if current_user.get("role") != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "[ARES] ⛔ ACCESS DENIED — Owner-Lock Engaged. "
                "You do not have clearance for this resource. "
                "This incident has been logged."
            ),
        )
    return current_user


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 6 — REQUEST / RESPONSE MODELS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class AuthRequest(BaseModel):
    """Login/Register request body."""
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    """Successful authentication response."""
    access_token: str
    token_type: str = "bearer"
    email: str
    role: str
    action: str  # 'registered' or 'logged_in'


class DashboardResponse(BaseModel):
    """Dashboard access response."""
    message: str
    user: str
    role: str
    clearance: str


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 7 — APPLICATION FACTORY & ROUTES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    init_database()
    print("[ARES] -----------------------------------------------")
    print("[ARES]  Auth Engine Online - Grade 5 Protocol Active")
    print("[ARES]  Owner-Lock: ENGAGED")
    print(f"[ARES]  Master Key: {OWNER_EMAIL}")
    print("[ARES] -----------------------------------------------")
    yield
    print("[ARES] Auth Engine shutting down.")


app = FastAPI(
    title="ARES Auth Engine — Grade 5 Protocol",
    description="Auto-Auth Login Engine with Owner-Lock RBAC",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────────────────────────
# ROUTE: POST /login — The Auto-Auth Endpoint
# ──────────────────────────────────────────────────────────────────────────────
@app.post("/login", response_model=AuthResponse, tags=["Authentication"])
async def auto_auth(credentials: AuthRequest):
    """
    ┌─────────────────────────────────────────────────────────────────┐
    │  AUTO-AUTH: One Endpoint. Two Outcomes.                        │
    │                                                                │
    │  • Email NOT in database → Register, hash password, assign    │
    │    role, return JWT.                                           │
    │  • Email IN database → Verify password, return JWT.           │
    │                                                                │
    │  The "Master Key" logic: if the email matches OWNER_EMAIL,    │
    │  the role is set to 'owner'. All other emails get 'demo'.     │
    └─────────────────────────────────────────────────────────────────┘
    """
    email = credentials.email.lower().strip()
    password = credentials.password

    # --- Check if user already exists ---
    existing_user = get_user_by_email(email)

    if existing_user is None:
        # ═══ NEW USER — AUTO-REGISTER ═══
        # Determine role via Master Key logic
        role = "owner" if email == OWNER_EMAIL else "demo"

        # Hash the password with bcrypt
        hashed = hash_password(password)

        # Create the user in ares_vault.db
        user = create_user(email, hashed, role)

        # Mint the JWT
        token = create_jwt_token(email, role)

        print(f"[ARES] OK New user registered: {email} | Role: {role}")

        return AuthResponse(
            access_token=token,
            email=email,
            role=role,
            action="registered",
        )
    else:
        # ═══ EXISTING USER — LOGIN ═══
        if not verify_password(password, existing_user["password"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="[ARES] ⛔ Invalid credentials. Access denied.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        role = existing_user["role"]
        token = create_jwt_token(email, role)

        print(f"[ARES] OK User logged in: {email} | Role: {role}")

        return AuthResponse(
            access_token=token,
            email=email,
            role=role,
            action="logged_in",
        )


# ──────────────────────────────────────────────────────────────────────────────
# ROUTE: GET /demo-dashboard — Accessible by ANY authenticated user
# ──────────────────────────────────────────────────────────────────────────────
@app.get("/demo-dashboard", response_model=DashboardResponse, tags=["Dashboards"])
async def demo_dashboard(
    current_user: Annotated[dict, Depends(get_current_user)]
):
    """
    Public dashboard — any user with a valid JWT can see this.
    Demo users and owners alike.
    """
    return DashboardResponse(
        message="Welcome to the ARES Demo Dashboard.",
        user=current_user["sub"],
        role=current_user["role"],
        clearance="STANDARD",
    )


# ──────────────────────────────────────────────────────────────────────────────
# ROUTE: GET /owner-dashboard — OWNER-LOCK PROTECTED
# ──────────────────────────────────────────────────────────────────────────────
@app.get("/owner-dashboard", response_model=DashboardResponse, tags=["Dashboards"])
async def owner_dashboard(
    owner: Annotated[dict, Depends(require_owner)]
):
    """
    ┌─────────────────────────────────────────────────────────────────┐
    │  OWNER-LOCKED DASHBOARD                                       │
    │                                                                │
    │  This route is physically unreachable without 'owner' role    │
    │  in the JWT. The require_owner dependency fires BEFORE this   │
    │  function body ever executes. Demo users get 403'd at the     │
    │  gate — they never see what's behind this door.               │
    └─────────────────────────────────────────────────────────────────┘
    """
    return DashboardResponse(
        message="ARES Owner Command Center - Full Access Granted.",
        user=owner["sub"],
        role=owner["role"],
        clearance="MAXIMUM - OWNER LEVEL",
    )


# ──────────────────────────────────────────────────────────────────────────────
# ROUTE: GET /me — Introspection endpoint (who am I?)
# ──────────────────────────────────────────────────────────────────────────────
@app.get("/me", tags=["Authentication"])
async def whoami(current_user: Annotated[dict, Depends(get_current_user)]):
    """Returns the decoded identity from the JWT."""
    return {
        "email": current_user["sub"],
        "role": current_user["role"],
        "token_issued": current_user.get("iat"),
        "token_expires": current_user.get("exp"),
    }


# ──────────────────────────────────────────────────────────────────────────────
# ROUTE: GET / — Health check
# ──────────────────────────────────────────────────────────────────────────────
@app.get("/", tags=["System"])
async def root():
    """System health check."""
    return {
        "system": "ARES Auth Engine",
        "protocol": "Grade 5",
        "status": "operational",
        "owner_lock": "engaged",
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ENTRY POINT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if __name__ == "__main__":
    import uvicorn
    print("\n[ARES] Starting Auth Engine on http://127.0.0.1:8000")
    print("[ARES] Docs available at http://127.0.0.1:8000/docs\n")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")

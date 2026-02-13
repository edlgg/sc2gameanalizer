"""
FastAPI backend for SC2 Replay Analyzer.
"""
import logging
import sys
import time

# Configure logging to output to stderr with timestamps
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stderr)]
)
from collections import defaultdict
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from pathlib import Path, PurePosixPath
import sqlite3
import uuid
from typing import List, Dict, Any, Optional, Tuple
from datetime import timedelta
import json
import os
from pydantic import BaseModel, EmailStr

from backend.src.parser import parse_replay_file
from backend.src.database import init_database, get_connection
from backend.api.similarity import find_similar_games
from backend.api.ml_similarity import find_similar_games_ml, GameEmbedder
from backend.api.auth import (
    init_user_tables,
    create_user,
    authenticate_user,
    get_user_by_id,
    create_access_token,
    decode_access_token,
    track_upload,
    can_upload,
    atomic_check_and_reserve_upload,
    update_subscription,
    SubscriptionTier,
    User,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from backend.api.crypto_payments import (
    init_payment_tables,
    create_payment,
    verify_payment,
    get_pending_payment,
    format_amount_display,
    build_eip681_uri,
    get_supported_tokens,
    get_price_usd,
    get_gas_estimate,
    CHAINS,
    PRO_PRICE,
    SUPPORT_EMAIL,
    TokenType,
)

logger = logging.getLogger(__name__)


# ============================================================================
# Helper Functions
# ============================================================================

def _safe_json_loads(data: Optional[str], default: Any = None) -> Any:
    """Safely parse JSON string, returning default on error."""
    if data is None:
        return default if default is not None else {}
    try:
        return json.loads(data)
    except (json.JSONDecodeError, TypeError) as e:
        logger.warning(f"Failed to parse JSON: {e}")
        return default if default is not None else {}


def _row_to_snapshot(row: Tuple) -> Dict[str, Any]:
    """
    Convert a database row to a snapshot dictionary.

    Expected row format (27 columns):
    (id, game_id, game_time_seconds, player_number, race,
     worker_count, mineral_collection_rate, gas_collection_rate,
     unspent_minerals, unspent_gas, total_minerals_collected, total_gas_collected,
     army_value_minerals, army_value_gas, army_supply, units,
     buildings, upgrades, base_count, vision_area, unit_map_presence,
     units_killed_value, units_lost_value,
     resources_spent_minerals, resources_spent_gas,
     collection_efficiency, spending_efficiency)
    """
    return {
        "id": row[0],
        "game_id": row[1],
        "game_time_seconds": row[2],
        "player_number": row[3],
        "race": row[4],
        "worker_count": row[5],
        "mineral_collection_rate": row[6],
        "gas_collection_rate": row[7],
        "unspent_minerals": row[8],
        "unspent_gas": row[9],
        "total_minerals_collected": row[10],
        "total_gas_collected": row[11],
        "army_value_minerals": row[12],
        "army_value_gas": row[13],
        "army_supply": row[14],
        "units": _safe_json_loads(row[15], {}),
        "buildings": _safe_json_loads(row[16], {}),
        "upgrades": _safe_json_loads(row[17], {}),
        "base_count": row[18],
        "vision_area": row[19],
        "unit_map_presence": _safe_json_loads(row[20], {}),
        "units_killed_value": row[21],
        "units_lost_value": row[22],
        "resources_spent_minerals": row[23],
        "resources_spent_gas": row[24],
        "collection_efficiency": row[25],
        "spending_efficiency": row[26]
    }


SNAPSHOT_SELECT_COLUMNS = """
    id, game_id, game_time_seconds, player_number, race,
    worker_count, mineral_collection_rate, gas_collection_rate,
    unspent_minerals, unspent_gas, total_minerals_collected, total_gas_collected,
    army_value_minerals, army_value_gas, army_supply, units,
    buildings, upgrades, base_count, vision_area, unit_map_presence,
    units_killed_value, units_lost_value,
    resources_spent_minerals, resources_spent_gas,
    collection_efficiency, spending_efficiency
"""


# Pydantic models for request/response
class UserRegister(BaseModel):
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    subscription_tier: str
    uploads_used: int
    uploads_limit: int  # -1 means unlimited


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# Security
security = HTTPBearer(auto_error=False)


# Simple in-memory rate limiter (no external dependencies)
class RateLimiter:
    """Simple token bucket rate limiter."""

    def __init__(self):
        self._requests: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
        """Check if request is allowed under rate limit."""
        now = time.time()
        window_start = now - window_seconds

        # Clean old requests
        timestamps = [t for t in self._requests.get(key, []) if t > window_start]

        if not timestamps:
            # All timestamps are stale (or key is new) — start fresh
            self._requests[key] = [now]
            return True

        if len(timestamps) >= max_requests:
            self._requests[key] = timestamps
            return False

        timestamps.append(now)
        self._requests[key] = timestamps
        return True


rate_limiter = RateLimiter()


def check_rate_limit(request: Request, max_requests: int, window_seconds: int):
    """Rate limit check helper. Raises 429 if exceeded."""
    client_ip = request.client.host if request.client else "unknown"
    endpoint = request.url.path

    if not rate_limiter.is_allowed(f"{client_ip}:{endpoint}", max_requests, window_seconds):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Please try again later."
        )


app = FastAPI(title="SC2 Replay Analyzer", version="1.0.0")

# Environment mode (set to 'production' in production)
DEBUG_MODE = os.getenv("DEBUG", "false").lower() == "true"


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler that sanitizes error messages in production.
    Prevents leaking internal details like file paths or stack traces.
    """
    # Let HTTPException pass through normally
    if isinstance(exc, HTTPException):
        raise exc

    # Log the full error for debugging
    logger.error(f"Unhandled exception: {exc}", exc_info=True)

    # In debug mode, return full error details
    if DEBUG_MODE:
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal error: {str(exc)}"}
        )

    # In production, return generic message
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again later."}
    )

# CORS configuration from environment or defaults
ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://kit.tail993c4d.ts.net",
]
# Filter out empty strings
ALLOWED_ORIGINS = [o.strip() for o in ALLOWED_ORIGINS if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.ts\.net",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# Database path
DB_PATH = Path(__file__).parent.parent / "data" / "replays.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# Upload directory for replay files
UPLOAD_DIR = Path(__file__).parent.parent / "data" / "replays"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ML embedder for similarity matching (initialized on startup)
EMBEDDER = None


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup if it doesn't exist."""
    global EMBEDDER

    if not DB_PATH.exists():
        init_database(DB_PATH)

    # Initialize user tables (safe to call multiple times)
    init_user_tables(DB_PATH)

    # Initialize payment tables
    init_payment_tables(DB_PATH)

    # Initialize ML embedder with cache
    cache_path = DB_PATH.parent / ".embeddings_cache.json"
    EMBEDDER = GameEmbedder(cache_path=cache_path)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Optional[User]:
    """
    Get the current authenticated user from JWT token.
    Returns None if no valid token is provided.
    """
    if not credentials:
        return None

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    return get_user_by_id(DB_PATH, int(user_id))


async def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    """
    Require authentication - raises 401 if no valid token.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = get_user_by_id(DB_PATH, int(user_id))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


def verify_game_access(game_id: int, user: User) -> dict:
    """
    Check if user can access a game. Returns game data or raises 403/404.

    Users can access:
    - Pro replays (accessible to all authenticated users)
    - Their own uploaded games
    """
    with get_connection(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("""
            SELECT id, replay_file, game_date, game_length_seconds, map_name,
                   player1_name, player1_race, player2_name, player2_race, result,
                   is_pro_replay
            FROM games
            WHERE id = ?
        """, (game_id,))

        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Game not found")

        game = dict(row)
        game['is_pro_replay'] = bool(game['is_pro_replay'])

        # Pro replays are accessible to all authenticated users
        if game['is_pro_replay']:
            return game

        # Check if user owns this game
        cursor.execute(
            "SELECT 1 FROM user_uploads WHERE user_id = ? AND game_id = ?",
            (user.id, game_id)
        )
        if not cursor.fetchone():
            raise HTTPException(status_code=403, detail="Access denied")

        return game


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "SC2 Replay Analyzer API"}


# ============================================================================
# Authentication Endpoints
# ============================================================================

@app.post("/api/auth/register", response_model=TokenResponse)
async def register(request: Request, user_data: UserRegister):
    """
    Register a new user account.

    Returns access token and user info on success.
    Rate limited to 5 requests per minute.
    """
    check_rate_limit(request, max_requests=5, window_seconds=60)

    if len(user_data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user = create_user(DB_PATH, user_data.email, user_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create access token
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    # Get upload stats
    _, uploads_used, uploads_limit = can_upload(DB_PATH, user.id)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            subscription_tier=user.subscription_tier.value,
            uploads_used=uploads_used,
            uploads_limit=uploads_limit
        )
    )


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(request: Request, user_data: UserLogin):
    """
    Login with email and password.

    Returns access token and user info on success.
    Rate limited to 10 requests per minute.
    """
    check_rate_limit(request, max_requests=10, window_seconds=60)

    user = authenticate_user(DB_PATH, user_data.email, user_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Create access token
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    # Get upload stats
    _, uploads_used, uploads_limit = can_upload(DB_PATH, user.id)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            subscription_tier=user.subscription_tier.value,
            uploads_used=uploads_used,
            uploads_limit=uploads_limit
        )
    )


@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(user: User = Depends(require_auth)):
    """
    Get current authenticated user info.
    """
    _, uploads_used, uploads_limit = can_upload(DB_PATH, user.id)

    return UserResponse(
        id=user.id,
        email=user.email,
        subscription_tier=user.subscription_tier.value,
        uploads_used=uploads_used,
        uploads_limit=uploads_limit
    )


# ============================================================================
# Crypto Payment Endpoints
# ============================================================================


class CreatePaymentRequest(BaseModel):
    chain: str = "polygon"  # Default to Polygon for low fees
    token: str = "usdc"  # usdc or usdt


@app.get("/api/payment/chains")
async def get_supported_chains_endpoint():
    """Get list of supported chains for payment with gas estimates."""
    chains = []
    for chain_id, config in CHAINS.items():
        tokens = get_supported_tokens(chain_id)
        if tokens:  # Only include chains with token support
            gas_estimate = get_gas_estimate(chain_id)
            chains.append({
                "id": chain_id,
                "name": config["name"],
                "chain_id": config["chain_id"],
                "tokens": tokens,
                "usdc_contract": config.get("usdc"),
                "usdt_contract": config.get("usdt"),
                "explorer": config["explorer"],
                "gas_estimate": gas_estimate,
            })
    return {
        "chains": chains,
        "support_email": SUPPORT_EMAIL,
        "price_usd": get_price_usd(),
    }


@app.post("/api/payment/create")
async def create_crypto_payment(
    http_request: Request,
    payment_request: CreatePaymentRequest,
    user: User = Depends(require_auth)
):
    """
    Create a new crypto payment for Pro upgrade.

    Returns treasury address, unique amount, and QR code URI.
    All payments go to the same treasury address with unique amounts for identification.
    Rate limited to 5 requests per minute.
    """
    check_rate_limit(http_request, max_requests=5, window_seconds=60)

    if user.subscription_tier == SubscriptionTier.PRO:
        raise HTTPException(status_code=400, detail="Already a Pro user")

    if payment_request.chain not in CHAINS:
        raise HTTPException(status_code=400, detail=f"Unsupported chain: {payment_request.chain}")

    # Validate token
    try:
        token = TokenType(payment_request.token.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unsupported token: {payment_request.token}")

    try:
        payment = create_payment(DB_PATH, user.id, payment_request.chain, token)
        chain_config = CHAINS.get(payment_request.chain)
        if not chain_config:
            raise HTTPException(status_code=400, detail=f"Chain '{payment_request.chain}' is no longer supported")

        # Build QR code URI
        qr_uri = build_eip681_uri(
            payment.address,
            payment_request.chain,
            token,
            payment.amount
        )

        return {
            "payment_id": payment.id,
            "address": payment.address,
            "amount": format_amount_display(payment.amount, token),
            "amount_raw": payment.amount,
            "amount_exact": payment.amount / 1_000_000,  # Float for display (e.g., 29.991)
            "token": token.value,
            "chain": payment_request.chain,
            "chain_id": chain_config["chain_id"],
            "chain_name": chain_config["name"],
            "token_contract": chain_config.get(token.value),
            "explorer": chain_config["explorer"],
            "expires_at": payment.expires_at.isoformat(),
            "status": payment.status.value,
            "qr_uri": qr_uri,
            "support_email": SUPPORT_EMAIL,
        }
    except ValueError as e:
        detail = str(e)
        if "concurrent payments" in detail.lower():
            raise HTTPException(status_code=503, detail=detail)
        raise HTTPException(status_code=400, detail=detail)


@app.get("/api/payment/status/{payment_id}")
async def check_payment_status(
    payment_id: int,
    user: User = Depends(require_auth)
):
    """
    Check if a payment has been received at the treasury and upgrade user if confirmed.
    No sweeping needed - funds go directly to treasury with unique amounts.
    """
    # Verify the requesting user owns this payment (return 404 to avoid leaking existence)
    with get_connection(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT user_id FROM pending_payments WHERE id = ?", (payment_id,))
        row = cursor.fetchone()
        if not row or row[0] != user.id:
            raise HTTPException(status_code=404, detail="Payment not found")

    is_paid, message = verify_payment(DB_PATH, payment_id)

    if is_paid:
        # Upgrade user to Pro
        update_subscription(DB_PATH, user.id, SubscriptionTier.PRO)

        # Refresh user data
        _, uploads_used, uploads_limit = can_upload(DB_PATH, user.id)

        return {
            "status": "confirmed",
            "message": "Payment confirmed! You now have Pro access.",
            "user": {
                "id": user.id,
                "email": user.email,
                "subscription_tier": "pro",
                "uploads_used": uploads_used,
                "uploads_limit": uploads_limit,
            }
        }

    return {
        "status": "pending",
        "message": message,
        "support_email": SUPPORT_EMAIL,
    }


@app.get("/api/payment/pending")
async def get_user_pending_payment(user: User = Depends(require_auth)):
    """Get any pending payment for the current user."""
    payment = get_pending_payment(DB_PATH, user.id)

    if not payment:
        return {"payment": None}

    chain_config = CHAINS.get(payment.chain)
    if not chain_config:
        raise HTTPException(status_code=400, detail=f"Chain '{payment.chain}' is no longer supported")

    # Build QR code URI
    qr_uri = build_eip681_uri(
        payment.address,
        payment.chain,
        payment.token,
        payment.amount
    )

    return {
        "payment": {
            "payment_id": payment.id,
            "address": payment.address,
            "amount": format_amount_display(payment.amount, payment.token),
            "amount_raw": payment.amount,
            "amount_exact": payment.amount / 1_000_000,  # Float for display (e.g., 29.991)
            "token": payment.token.value,
            "chain": payment.chain,
            "chain_id": chain_config["chain_id"],
            "chain_name": chain_config["name"],
            "token_contract": chain_config.get(payment.token.value),
            "explorer": chain_config["explorer"],
            "expires_at": payment.expires_at.isoformat(),
            "status": payment.status.value,
            "qr_uri": qr_uri,
        },
        "support_email": SUPPORT_EMAIL,
    }


# ============================================================================
# Replay Upload & Games Endpoints
# ============================================================================

@app.post("/api/upload")
async def upload_replay(
    request: Request,
    file: UploadFile = File(...),
    user: Optional[User] = Depends(get_current_user)
):
    """
    Upload and parse a SC2 replay file.

    Requires authentication. Free users limited to 3 uploads/month.
    Pro users have unlimited uploads.
    Rate limited to 20 requests per minute.

    Args:
        file: The .SC2Replay file to upload

    Returns:
        Game metadata and ID of the parsed game
    """
    check_rate_limit(request, max_requests=20, window_seconds=60)

    # Require authentication
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Please login or create an account."
        )

    # Check upload limits for free users (non-atomic pre-check for fast rejection)
    allowed, uploads_used, uploads_limit = can_upload(DB_PATH, user.id)
    if not allowed:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "upload_limit_reached",
                "message": f"Free tier limit of {uploads_limit} replays/month reached. Upgrade to Pro for unlimited uploads.",
                "uploads_used": uploads_used,
                "uploads_limit": uploads_limit
            }
        )

    # Sanitize filename — prevent path traversal
    safe_filename = PurePosixPath(file.filename).name if file.filename else "unnamed.SC2Replay"
    if not safe_filename or safe_filename.startswith('.'):
        raise HTTPException(status_code=400, detail="Invalid filename")

    # Validate file extension
    if not safe_filename.endswith('.SC2Replay'):
        raise HTTPException(status_code=400, detail="File must be a .SC2Replay file")

    # Add file size limit — prevent DoS
    MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50MB — SC2 replays are typically 50KB-2MB
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 50MB")

    # Generate unique filename — prevent collisions between users
    unique_name = f"{uuid.uuid4().hex[:8]}_{safe_filename}"
    permanent_path = UPLOAD_DIR / unique_name
    with open(permanent_path, 'wb') as f:
        f.write(content)

    try:
        # Parse the replay (using the permanent path so filename matches)
        parse_replay_file(permanent_path, DB_PATH)

        # Get the newly created game
        with get_connection(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, replay_file, game_date, game_length_seconds, map_name,
                       player1_name, player1_race, player2_name, player2_race, result
                FROM games
                WHERE replay_file = ?
            """, (unique_name,))

            row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=500, detail="Failed to retrieve parsed game")

        game_id = row[0]
        game = {
            "id": game_id,
            "replay_file": row[1],
            "game_date": row[2],
            "game_length_seconds": row[3],
            "map_name": row[4],
            "player1_name": row[5],
            "player1_race": row[6],
            "player2_name": row[7],
            "player2_race": row[8],
            "result": row[9]
        }

        # Atomically check quota and reserve upload slot (prevents TOCTOU race condition)
        allowed, new_uploads_used, new_uploads_limit = atomic_check_and_reserve_upload(
            DB_PATH, user.id, game_id
        )
        if not allowed:
            # Race condition: another request used the last slot between pre-check and here.
            # Clean up the parsed game data.
            with get_connection(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM build_order_events WHERE game_id = ?", (game_id,))
                cursor.execute("DELETE FROM snapshots WHERE game_id = ?", (game_id,))
                cursor.execute("DELETE FROM games WHERE id = ?", (game_id,))
                conn.commit()
            permanent_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "upload_limit_reached",
                    "message": f"Upload limit reached ({new_uploads_used}/{new_uploads_limit}). Upgrade to Pro for unlimited uploads.",
                    "uploads_used": new_uploads_used,
                    "uploads_limit": new_uploads_limit
                }
            )

        return {
            "success": True,
            "game": game,
            "uploads_used": new_uploads_used + 1,
            "uploads_limit": new_uploads_limit
        }

    except ValueError as e:
        # Validation error (not 1v1, too short, etc.) - these are user-facing
        permanent_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Log full error for debugging
        logger.error(f"Failed to parse replay {unique_name}: {e}", exc_info=True)
        permanent_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to parse replay. The file may be corrupted or in an unsupported format."
        )


@app.get("/api/games")
async def get_games(
    is_pro: Optional[bool] = None,
    map_name: Optional[str] = None,
    race: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200, description="Max games to return"),
    offset: int = Query(default=0, ge=0, description="Number of games to skip"),
    user: User = Depends(require_auth)
):
    """
    Get games accessible to the current user with optional filters.

    Returns pro replays (accessible to all) and user's own uploaded games.

    Args:
        is_pro: Filter for pro replays (True) or user replays (False)
        map_name: Filter by map name
        race: Filter by race (player1 or player2)
        limit: Maximum number of games to return (default: 50, max: 200)
        offset: Number of games to skip for pagination (default: 0)

    Returns:
        List of games with pagination info
    """
    with get_connection(DB_PATH) as conn:
        cursor = conn.cursor()

        # Base WHERE clause
        where_clause = "(g.is_pro_replay = 1 OR u.user_id IS NOT NULL)"
        params: list = [user.id]

        if is_pro is not None:
            where_clause += " AND g.is_pro_replay = ?"
            params.append(1 if is_pro else 0)

        if map_name:
            where_clause += " AND g.map_name LIKE ?"
            params.append(f"%{map_name}%")

        if race:
            where_clause += " AND (g.player1_race = ? OR g.player2_race = ?)"
            params.append(race)
            params.append(race)

        # Get total count for pagination
        count_query = f"""
            SELECT COUNT(DISTINCT g.id)
            FROM games g
            LEFT JOIN user_uploads u ON g.id = u.game_id AND u.user_id = ?
            WHERE {where_clause}
        """
        cursor.execute(count_query, params)
        total_count = cursor.fetchone()[0]

        # Get paginated results
        query = f"""
            SELECT DISTINCT g.id, g.replay_file, g.game_date, g.game_length_seconds, g.map_name,
                   g.player1_name, g.player1_race, g.player2_name, g.player2_race, g.result,
                   g.is_pro_replay
            FROM games g
            LEFT JOIN user_uploads u ON g.id = u.game_id AND u.user_id = ?
            WHERE {where_clause}
            ORDER BY g.game_date DESC
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])

        cursor.execute(query, params)
        rows = cursor.fetchall()

    games = []
    for row in rows:
        games.append({
            "id": row[0],
            "replay_file": row[1],
            "game_date": row[2],
            "game_length_seconds": row[3],
            "map_name": row[4],
            "player1_name": row[5],
            "player1_race": row[6],
            "player2_name": row[7],
            "player2_race": row[8],
            "result": row[9],
            "is_pro_replay": bool(row[10])
        })

    return {
        "games": games,
        "pagination": {
            "total": total_count,
            "limit": limit,
            "offset": offset,
            "has_more": offset + len(games) < total_count
        }
    }


@app.get("/api/games/{game_id}")
async def get_game(game_id: int, user: User = Depends(require_auth)):
    """
    Get detailed information about a specific game.

    Requires authentication. User can only access pro replays or their own uploads.

    Args:
        game_id: The game ID

    Returns:
        Game metadata
    """
    return verify_game_access(game_id, user)


@app.get("/api/games/{game_id}/snapshots")
async def get_snapshots(
    game_id: int,
    player_number: Optional[int] = None,
    user: User = Depends(require_auth)
):
    """
    Get snapshots for a specific game.

    Requires authentication. User can only access pro replays or their own uploads.

    Args:
        game_id: The game ID
        player_number: Optional filter for player 1 or 2

    Returns:
        List of snapshots
    """
    # Verify user has access to this game
    verify_game_access(game_id, user)

    with get_connection(DB_PATH) as conn:
        cursor = conn.cursor()

        query = f"""
            SELECT {SNAPSHOT_SELECT_COLUMNS}
            FROM snapshots
            WHERE game_id = ?
        """
        params: List[Any] = [game_id]

        if player_number:
            query += " AND player_number = ?"
            params.append(player_number)

        query += " ORDER BY game_time_seconds, player_number"

        cursor.execute(query, params)
        rows = cursor.fetchall()

    snapshots = [_row_to_snapshot(row) for row in rows]
    return {"snapshots": snapshots}


@app.get("/api/games/{game_id}/similar")
async def get_similar_games(
    game_id: int,
    limit: int = 3,
    use_ml: bool = True,
    user: User = Depends(require_auth)
):
    """
    Find similar pro games to compare against.

    Requires authentication. User can only find similar games for their own uploads or pro replays.

    Args:
        game_id: The user's game ID
        limit: Number of similar games to return (default: 3)
        use_ml: Whether to use ML-based similarity (default: True)

    Returns:
        List of similar pro games with similarity scores
    """
    # Verify user has access to this game
    verify_game_access(game_id, user)

    if use_ml and EMBEDDER is not None:
        # Use advanced ML-based similarity
        similar = find_similar_games_ml(DB_PATH, game_id, limit, embedder=EMBEDDER)
    else:
        # Fall back to basic similarity
        similar = find_similar_games(DB_PATH, game_id, limit)

    return {"similar_games": similar}


@app.get("/api/games/{game_id}/snapshots-race-matched")
async def get_snapshots_race_matched(
    game_id: int,
    user_game_id: int,
    user_player_number: int = 1,
    user: User = Depends(require_auth)
):
    """
    Get snapshots for a game, automatically selecting the player that matches
    the user's race.

    Requires authentication. User must have access to both games.

    Args:
        game_id: The game ID to get snapshots from
        user_game_id: The user's game ID (to determine user's race)
        user_player_number: Which player is the user in their game (1 or 2)

    Returns:
        List of snapshots for the matching player
    """
    # Verify user has access to both games
    verify_game_access(game_id, user)
    verify_game_access(user_game_id, user)

    with get_connection(DB_PATH) as conn:
        cursor = conn.cursor()

        # Get user's race
        cursor.execute("""
            SELECT player1_race, player2_race
            FROM games
            WHERE id = ?
        """, (user_game_id,))

        user_game_row = cursor.fetchone()
        if not user_game_row:
            raise HTTPException(status_code=404, detail="User game not found")

        user_race = user_game_row[0] if user_player_number == 1 else user_game_row[1]

        # Get the target game's races to determine which player to use
        cursor.execute("""
            SELECT player1_race, player2_race
            FROM games
            WHERE id = ?
        """, (game_id,))

        target_game_row = cursor.fetchone()
        if not target_game_row:
            raise HTTPException(status_code=404, detail="Target game not found")

        target_p1_race, target_p2_race = target_game_row

        # Find which player has the matching race
        if target_p1_race == user_race:
            target_player_number = 1
        elif target_p2_race == user_race:
            target_player_number = 2
        else:
            # No matching race, return empty with explanation
            return {"snapshots": [], "message": "No player with matching race found"}

        # Get snapshots for the matching player
        query = f"""
            SELECT {SNAPSHOT_SELECT_COLUMNS}
            FROM snapshots
            WHERE game_id = ? AND player_number = ?
            ORDER BY game_time_seconds
        """

        cursor.execute(query, (game_id, target_player_number))
        rows = cursor.fetchall()

    snapshots = [_row_to_snapshot(row) for row in rows]
    return {"snapshots": snapshots}


@app.get("/api/compare/{game_id1}/{game_id2}")
async def compare_games(
    game_id1: int,
    game_id2: int,
    user: User = Depends(require_auth)
):
    """
    Get comparison data for two games.

    Requires authentication. User must have access to both games.

    Args:
        game_id1: First game ID
        game_id2: Second game ID

    Returns:
        Comparison data including both games and their snapshots
    """
    # Verify user has access to both games
    verify_game_access(game_id1, user)
    verify_game_access(game_id2, user)

    with get_connection(DB_PATH) as conn:
        cursor = conn.cursor()

        # Get both games
        cursor.execute("""
            SELECT id, replay_file, game_date, game_length_seconds, map_name,
                   player1_name, player1_race, player2_name, player2_race, result,
                   is_pro_replay
            FROM games
            WHERE id IN (?, ?)
        """, (game_id1, game_id2))

        rows = cursor.fetchall()
        if len(rows) != 2:
            raise HTTPException(status_code=404, detail="One or both games not found")

        games = {}
        for row in rows:
            game_id = row[0]
            games[game_id] = {
                "id": row[0],
                "replay_file": row[1],
                "game_date": row[2],
                "game_length_seconds": row[3],
                "map_name": row[4],
                "player1_name": row[5],
                "player1_race": row[6],
                "player2_name": row[7],
                "player2_race": row[8],
                "result": row[9],
                "is_pro_replay": bool(row[10])
            }

        # Get snapshots for both games (using full column set)
        cursor.execute(f"""
            SELECT {SNAPSHOT_SELECT_COLUMNS}
            FROM snapshots
            WHERE game_id IN (?, ?)
            ORDER BY game_id, game_time_seconds, player_number
        """, (game_id1, game_id2))

        rows = cursor.fetchall()

    snapshots = {game_id1: [], game_id2: []}
    for row in rows:
        snapshot = _row_to_snapshot(row)
        game_id = snapshot["game_id"]
        snapshots[game_id].append(snapshot)

    return {
        "game1": games[game_id1],
        "game2": games[game_id2],
        "snapshots1": snapshots[game_id1],
        "snapshots2": snapshots[game_id2]
    }


@app.get("/api/games/{game_id}/build-order")
async def get_build_order(
    game_id: int,
    player_number: Optional[int] = None,
    milestones_only: bool = False,
    user: User = Depends(require_auth)
):
    """
    Get build order events for a game.

    Requires authentication. User can only access pro replays or their own uploads.

    Args:
        game_id: The game ID
        player_number: Filter by player (1 or 2), or None for both
        milestones_only: If True, only return milestone events

    Returns:
        List of build order events
    """
    # Verify user has access to this game
    verify_game_access(game_id, user)

    with get_connection(DB_PATH) as conn:
        cursor = conn.cursor()

        query = """
            SELECT event_type, item_name, game_time_seconds, player_number, is_milestone
            FROM build_order_events
            WHERE game_id = ?
        """
        params = [game_id]

        if player_number is not None:
            query += " AND player_number = ?"
            params.append(player_number)

        if milestones_only:
            query += " AND is_milestone = 1"

        query += " ORDER BY game_time_seconds ASC"

        cursor.execute(query, params)
        rows = cursor.fetchall()

    events = []
    for row in rows:
        events.append({
            "event_type": row[0],
            "item_name": row[1],
            "game_time_seconds": row[2],
            "player_number": row[3],
            "is_milestone": bool(row[4])
        })

    return {"events": events}


@app.get("/api/games/{game_id}/build-order-comparison")
async def compare_build_orders(
    game_id: int,
    pro_game_ids: str,
    player_number: int = 1,
    user: User = Depends(require_auth)
):
    """
    Compare build order between user game and multiple pro games.

    Requires authentication. User must have access to the user game.
    Pro games are validated as pro replays.

    Args:
        game_id: The user's game ID
        pro_game_ids: Comma-separated list of pro game IDs
        player_number: Which player to analyze (1 or 2)

    Returns:
        Build order comparison with timing differences
    """
    from backend.src.build_order import analyze_timing_differences

    # Verify user has access to their game
    verify_game_access(game_id, user)

    # Parse pro game IDs
    pro_ids = [int(pid) for pid in pro_game_ids.split(',')]

    # Verify all pro games are accessible (they should be pro replays)
    for pro_id in pro_ids:
        verify_game_access(pro_id, user)

    with get_connection(DB_PATH) as conn:
        cursor = conn.cursor()

        # Get user build order events
        cursor.execute("""
            SELECT event_type, item_name, game_time_seconds, is_milestone
            FROM build_order_events
            WHERE game_id = ? AND player_number = ?
            ORDER BY game_time_seconds ASC
        """, (game_id, player_number))

        user_events = []
        for row in cursor.fetchall():
            user_events.append({
                "event_type": row[0],
                "item_name": row[1],
                "game_time_seconds": row[2],
                "is_milestone": bool(row[3])
            })

        # Get user's race from their game
        cursor.execute("""
            SELECT player1_race, player2_race
            FROM games WHERE id = ?
        """, (game_id,))
        user_game_row = cursor.fetchone()
        if not user_game_row:
            raise HTTPException(status_code=404, detail="User game not found")

        user_race = user_game_row[0] if player_number == 1 else user_game_row[1]

        # Get all pro games' races in a single query (fixes N+1)
        placeholders = ','.join('?' * len(pro_ids))
        cursor.execute(f"""
            SELECT id, player1_race, player2_race
            FROM games
            WHERE id IN ({placeholders})
        """, pro_ids)

        pro_games_races = {row[0]: (row[1], row[2]) for row in cursor.fetchall()}

        # Build mapping of pro game ID to player number based on race match
        pro_player_mapping = {}
        for pro_id in pro_ids:
            if pro_id not in pro_games_races:
                continue
            pro_p1_race, pro_p2_race = pro_games_races[pro_id]
            if pro_p1_race == user_race:
                pro_player_mapping[pro_id] = 1
            elif pro_p2_race == user_race:
                pro_player_mapping[pro_id] = 2
            # else: no matching race, skip

        # Get all build order events for matching pro games in a single query (fixes N+1)
        if pro_player_mapping:
            # Build WHERE clause for (game_id, player_number) pairs
            conditions = ' OR '.join(
                f'(game_id = ? AND player_number = ?)'
                for _ in pro_player_mapping
            )
            params = []
            for pro_id, player_num in pro_player_mapping.items():
                params.extend([pro_id, player_num])

            cursor.execute(f"""
                SELECT game_id, event_type, item_name, game_time_seconds, is_milestone
                FROM build_order_events
                WHERE {conditions}
                ORDER BY game_id, game_time_seconds ASC
            """, params)

            # Group events by game_id
            pro_events_by_game: Dict[int, List[Dict]] = {}
            for row in cursor.fetchall():
                gid = row[0]
                if gid not in pro_events_by_game:
                    pro_events_by_game[gid] = []
                pro_events_by_game[gid].append({
                    "event_type": row[1],
                    "item_name": row[2],
                    "game_time_seconds": row[3],
                    "is_milestone": bool(row[4])
                })

            # Collect non-empty event sets
            pro_events_sets = [
                events for events in pro_events_by_game.values() if events
            ]
        else:
            pro_events_sets = []

    # Analyze timing differences
    analysis = analyze_timing_differences(user_events, pro_events_sets)

    return {
        "user_events": user_events,
        "pro_events_count": len(pro_events_sets),
        "analysis": analysis
    }


@app.delete("/api/games/{game_id}")
async def delete_game(game_id: int, user: User = Depends(require_auth)):
    """
    Delete a specific game and all its associated data.
    Requires authentication. Users can only delete their own uploaded games.

    Args:
        game_id: The game ID to delete

    Returns:
        Success message
    """
    with get_connection(DB_PATH) as conn:
        cursor = conn.cursor()

        # Check if user owns this game (via user_uploads table)
        cursor.execute("""
            SELECT 1 FROM user_uploads WHERE user_id = ? AND game_id = ?
        """, (user.id, game_id))
        if not cursor.fetchone():
            # Check if game exists at all
            cursor.execute("SELECT 1 FROM games WHERE id = ?", (game_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Game not found")
            raise HTTPException(status_code=403, detail="You can only delete your own uploaded games")

        # Get replay file name before deleting
        cursor.execute("SELECT replay_file FROM games WHERE id = ?", (game_id,))
        row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Game not found")

        replay_file = row[0]

        # Delete from database — explicit child table deletes as belt-and-suspenders with CASCADE
        cursor.execute("DELETE FROM build_order_events WHERE game_id = ?", (game_id,))
        cursor.execute("DELETE FROM snapshots WHERE game_id = ?", (game_id,))
        cursor.execute("DELETE FROM user_uploads WHERE game_id = ?", (game_id,))
        cursor.execute("DELETE FROM games WHERE id = ?", (game_id,))
        conn.commit()

    # Delete replay file from disk
    replay_path = UPLOAD_DIR / replay_file
    if replay_path.exists():
        replay_path.unlink()

    return {"success": True, "message": f"Game {game_id} deleted successfully"}


@app.delete("/api/games")
async def delete_all_games(user: User = Depends(require_auth), keep_pro_replays: bool = True):
    """
    Delete all games uploaded by the current user.
    Requires authentication. Only deletes games the user owns.

    Args:
        keep_pro_replays: If True, only delete non-pro replays (default: True)

    Returns:
        Success message with count of deleted games
    """
    with get_connection(DB_PATH) as conn:
        cursor = conn.cursor()

        # Only delete games that belong to the current user
        if keep_pro_replays:
            cursor.execute("""
                SELECT g.id, g.replay_file FROM games g
                JOIN user_uploads u ON g.id = u.game_id
                WHERE u.user_id = ? AND g.is_pro_replay = 0
            """, (user.id,))
        else:
            cursor.execute("""
                SELECT g.id, g.replay_file FROM games g
                JOIN user_uploads u ON g.id = u.game_id
                WHERE u.user_id = ?
            """, (user.id,))

        rows = cursor.fetchall()
        game_ids = [row[0] for row in rows]
        replay_files = [row[1] for row in rows]
        game_count = len(rows)

        # Delete from database — explicit child table deletes as belt-and-suspenders with CASCADE
        if game_ids:
            placeholders = ','.join('?' * len(game_ids))
            cursor.execute(f"DELETE FROM build_order_events WHERE game_id IN ({placeholders})", game_ids)
            cursor.execute(f"DELETE FROM snapshots WHERE game_id IN ({placeholders})", game_ids)
            cursor.execute(f"DELETE FROM user_uploads WHERE game_id IN ({placeholders})", game_ids)
            cursor.execute(f"DELETE FROM games WHERE id IN ({placeholders})", game_ids)

        conn.commit()

    # Delete replay files from disk
    for replay_file in replay_files:
        replay_path = UPLOAD_DIR / replay_file
        if replay_path.exists():
            replay_path.unlink()

    message = f"Deleted {game_count} {'user ' if keep_pro_replays else ''}game(s)"
    return {"success": True, "message": message, "deleted_count": game_count}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

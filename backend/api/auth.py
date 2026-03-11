"""
Authentication module for SC2 Replay Analyzer.
Handles user registration, login, JWT tokens, and subscription management.
"""
import psycopg2
import psycopg2.errors
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from dataclasses import dataclass
from enum import Enum

from backend.src.database import get_connection, get_connection_direct, return_connection

# Load .env file if it exists
from dotenv import load_dotenv
load_dotenv()

import bcrypt
from jose import jwt, JWTError


def _utc_now() -> datetime:
    """Get current UTC time (timezone-aware)."""
    return datetime.now(timezone.utc)


def _parse_datetime(dt_str: str) -> datetime:
    """Parse ISO datetime string and ensure it's timezone-aware (UTC)."""
    dt = datetime.fromisoformat(dt_str)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


# JWT settings - loaded from environment variables
def _get_secret_key() -> str:
    """Get JWT secret key from environment with validation."""
    key = os.getenv("JWT_SECRET_KEY")
    if not key:
        raise RuntimeError(
            "JWT_SECRET_KEY environment variable is required. "
            "Generate a secure key with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
        )
    if len(key) < 32:
        raise RuntimeError(
            "JWT_SECRET_KEY must be at least 32 characters for security"
        )
    return key

SECRET_KEY = _get_secret_key()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours (reduced from 7 days for security)


class SubscriptionTier(str, Enum):
    FREE = "free"
    PRO = "pro"


@dataclass
class User:
    id: int
    email: str
    hashed_password: str
    subscription_tier: SubscriptionTier
    stripe_customer_id: Optional[str]
    created_at: datetime
    updated_at: datetime


@dataclass
class UserUpload:
    id: int
    user_id: int
    game_id: int
    uploaded_at: datetime


# Upload limits
FREE_TIER_UPLOADS_PER_MONTH = 3
MAX_UPLOADS_TOTAL = 200


def init_user_tables() -> None:
    """
    Initialize user-related tables. Does NOT drop existing tables.
    Safe to call multiple times - uses IF NOT EXISTS.
    """
    with get_connection() as conn:
        cursor = conn.cursor()

        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                hashed_password TEXT NOT NULL,
                subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
                stripe_customer_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create user_uploads table to track uploads per user
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_uploads (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, game_id)
            )
        """)

        # Create indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_uploads_user_id ON user_uploads(user_id)
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_uploads_uploaded_at ON user_uploads(uploaded_at)
        """)


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    password_bytes = plain_password.encode('utf-8')
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = _utc_now() + expires_delta
    else:
        expire = _utc_now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT access token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def create_user(email: str, password: str) -> Optional[User]:
    """
    Create a new user account.

    Returns the created user or None if email already exists.
    """
    hashed_password = hash_password(password)

    try:
        with get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                INSERT INTO users (email, hashed_password, subscription_tier)
                VALUES (%s, %s, 'free')
                RETURNING id
            """, (email, hashed_password))

            user_id = cursor.fetchone()[0]
            cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            row = cursor.fetchone()

            if row:
                return User(
                    id=row[0],
                    email=row[1],
                    hashed_password=row[2],
                    subscription_tier=SubscriptionTier(row[3]),
                    stripe_customer_id=row[4],
                    created_at=_parse_datetime(row[5]) if row[5] else _utc_now(),
                    updated_at=_parse_datetime(row[6]) if row[6] else _utc_now()
                )
            return None

    except psycopg2.IntegrityError:
        # Email already exists
        return None


def _row_to_user(row: tuple) -> User:
    """Convert a database row to a User object."""
    return User(
        id=row[0],
        email=row[1],
        hashed_password=row[2],
        subscription_tier=SubscriptionTier(row[3]),
        stripe_customer_id=row[4],
        created_at=_parse_datetime(row[5]) if row[5] else _utc_now(),
        updated_at=_parse_datetime(row[6]) if row[6] else _utc_now()
    )


def get_user_by_email(email: str) -> Optional[User]:
    """Get a user by email address."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        row = cursor.fetchone()

    if row:
        return _row_to_user(row)
    return None


def get_user_by_id(user_id: int) -> Optional[User]:
    """Get a user by ID."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        row = cursor.fetchone()

    if row:
        return _row_to_user(row)
    return None


def authenticate_user(email: str, password: str) -> Optional[User]:
    """Authenticate a user by email and password."""
    user = get_user_by_email(email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def track_upload(user_id: int, game_id: int) -> None:
    """Track a replay upload for a user."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_uploads (user_id, game_id)
            VALUES (%s, %s)
            ON CONFLICT DO NOTHING
        """, (user_id, game_id))


def get_uploads_this_month(user_id: int) -> int:
    """Get the number of uploads a user has made this month."""
    # Get first day of current month
    now = _utc_now()
    first_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) FROM user_uploads
            WHERE user_id = %s AND uploaded_at >= %s
        """, (user_id, first_of_month.isoformat()))
        count = cursor.fetchone()[0]

    return count


def get_uploads_total(user_id: int) -> int:
    """Get the total number of uploads a user has ever made."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM user_uploads WHERE user_id = %s", (user_id,)
        )
        return cursor.fetchone()[0]


def can_upload(user_id: int) -> tuple[bool, int, int]:
    """
    Check if a user can upload a replay.

    Returns:
        tuple of (can_upload, uploads_used, uploads_limit)
    """
    user = get_user_by_id(user_id)
    if not user:
        return False, 0, 0

    # Hard cap for all users
    total = get_uploads_total(user_id)
    if total >= MAX_UPLOADS_TOTAL:
        return False, total, MAX_UPLOADS_TOTAL

    if user.subscription_tier == SubscriptionTier.PRO:
        return True, total, -1  # -1 means unlimited monthly

    uploads_used = get_uploads_this_month(user_id)
    can_do = uploads_used < FREE_TIER_UPLOADS_PER_MONTH

    return can_do, uploads_used, FREE_TIER_UPLOADS_PER_MONTH


def atomic_check_and_reserve_upload(user_id: int, game_id: int) -> tuple[bool, int, int]:
    """
    Atomically check upload quota and reserve a slot by inserting into user_uploads.

    Uses a serializable transaction to prevent TOCTOU race conditions where concurrent
    requests could both pass the quota check before either records the upload.

    Returns:
        tuple of (allowed, uploads_used, uploads_limit)
    """
    conn = get_connection_direct()
    try:
        conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_SERIALIZABLE)
        cursor = conn.cursor()

        # Check subscription tier
        cursor.execute("SELECT subscription_tier FROM users WHERE id = %s", (user_id,))
        user_row = cursor.fetchone()
        if not user_row:
            conn.commit()
            return False, 0, 0

        tier = user_row[0]

        # Hard cap for all users
        cursor.execute(
            "SELECT COUNT(*) FROM user_uploads WHERE user_id = %s", (user_id,)
        )
        total = cursor.fetchone()[0]
        if total >= MAX_UPLOADS_TOTAL:
            conn.commit()
            return False, total, MAX_UPLOADS_TOTAL

        if tier == "pro":
            # Pro users: insert and return
            cursor.execute(
                "INSERT INTO user_uploads (user_id, game_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (user_id, game_id),
            )
            conn.commit()
            return True, total, -1

        # Free tier: count this month's uploads
        now = _utc_now()
        first_of_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        cursor.execute(
            "SELECT COUNT(*) FROM user_uploads WHERE user_id = %s AND uploaded_at >= %s",
            (user_id, first_of_month.isoformat()),
        )
        uploads_used = cursor.fetchone()[0]

        if uploads_used >= FREE_TIER_UPLOADS_PER_MONTH:
            conn.commit()
            return False, uploads_used, FREE_TIER_UPLOADS_PER_MONTH

        # Reserve the slot
        cursor.execute(
            "INSERT INTO user_uploads (user_id, game_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (user_id, game_id),
        )
        conn.commit()
        return True, uploads_used, FREE_TIER_UPLOADS_PER_MONTH
    except Exception:
        conn.rollback()
        raise
    finally:
        return_connection(conn)


def update_subscription(user_id: int, tier: SubscriptionTier, stripe_customer_id: Optional[str] = None) -> bool:
    """Update a user's subscription tier."""
    with get_connection() as conn:
        cursor = conn.cursor()

        if stripe_customer_id:
            cursor.execute("""
                UPDATE users
                SET subscription_tier = %s, stripe_customer_id = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (tier.value, stripe_customer_id, user_id))
        else:
            cursor.execute("""
                UPDATE users
                SET subscription_tier = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (tier.value, user_id))

        rows_affected = cursor.rowcount

    return rows_affected > 0

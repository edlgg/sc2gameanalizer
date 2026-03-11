# ContainerDuck Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy SC2 Game Analyzer to containerduck.com with QA and Prod environments, migrating from SQLite to PostgreSQL.

**Architecture:** Monorepo deploys as 3 apps per environment on ContainerDuck: PostgreSQL (catalog app), backend (hosted app from `backend/` subdirectory), frontend (hosted app from `frontend/` subdirectory). QA deploys from `qa` branch, Prod from `main`. Frontend calls backend via `VITE_API_URL` baked at build time.

**Tech Stack:** Python 3.13 / FastAPI / psycopg2-binary (backend), React 19 / Vite / TypeScript (frontend), PostgreSQL via ContainerDuck CNPG, Dockerfile builds.

---

## Task 1: Add psycopg2-binary dependency and DATABASE_URL support

**Files:**
- Modify: `backend/pyproject.toml`
- Modify: `backend/.env.example`

**Step 1: Add psycopg2-binary to pyproject.toml**

In `backend/pyproject.toml`, add to dependencies:
```toml
    "psycopg2-binary>=2.9.9",
```

**Step 2: Add DATABASE_URL to .env.example**

Add to `backend/.env.example`:
```
# PostgreSQL connection (required for deployed environments)
# Format: postgresql://user:password@host:port/dbname
# DATABASE_URL=postgresql://postgres:password@localhost:5432/sc2analyzer
#
# Legacy SQLite support (local dev only, deprecated)
# DATABASE_PATH=data/replays.db
```

**Step 3: Install dependencies**

Run: `uv sync --project backend`
Expected: psycopg2-binary installs successfully

**Step 4: Commit**

```bash
git add backend/pyproject.toml backend/.env.example
git commit -m "feat: add psycopg2-binary dependency for PostgreSQL migration"
```

---

## Task 2: Rewrite database.py for PostgreSQL

**Files:**
- Modify: `backend/src/database.py`

This is the core migration. Replace sqlite3 with psycopg2, change all SQL syntax.

**Step 1: Rewrite database.py**

Replace the entire file with PostgreSQL implementation:

```python
"""
Database schema and operations for SC2 replay snapshots.
Supports PostgreSQL (via DATABASE_URL) with SQLite fallback (via DATABASE_PATH).
"""
import os
import json
import logging
from typing import Dict, List, Any, Optional
from contextlib import contextmanager

import psycopg2
import psycopg2.pool
import psycopg2.extras

logger = logging.getLogger(__name__)

# Module-level connection pool
_pool: Optional[psycopg2.pool.SimpleConnectionPool] = None


def get_database_url() -> str:
    """Get DATABASE_URL from environment."""
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL environment variable is required. "
            "Format: postgresql://user:password@host:port/dbname"
        )
    return url


def init_pool(min_conn: int = 1, max_conn: int = 10) -> None:
    """Initialize the connection pool."""
    global _pool
    if _pool is not None:
        return
    url = get_database_url()
    _pool = psycopg2.pool.SimpleConnectionPool(min_conn, max_conn, url)
    logger.info("Database connection pool initialized")


def close_pool() -> None:
    """Close the connection pool."""
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None


@contextmanager
def get_connection():
    """
    Get a connection from the pool as a context manager.
    Auto-commits on success, rolls back on exception.

    Usage:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(...)
    """
    if _pool is None:
        init_pool()
    conn = _pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)


def get_connection_direct():
    """
    Get a raw connection from the pool (caller manages commit/rollback/return).
    Used by code that needs manual transaction control.

    IMPORTANT: Caller MUST call return_connection() when done.
    """
    if _pool is None:
        init_pool()
    return _pool.getconn()


def return_connection(conn) -> None:
    """Return a connection obtained via get_connection_direct() back to the pool."""
    if _pool is not None:
        _pool.putconn(conn)


def init_database() -> None:
    """
    Initialize the database with all tables.
    Safe to call multiple times - uses CREATE TABLE IF NOT EXISTS.
    """
    with get_connection() as conn:
        cursor = conn.cursor()

        # Create games table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS games (
                id SERIAL PRIMARY KEY,
                replay_file TEXT NOT NULL UNIQUE,

                -- Game Metadata
                game_date TIMESTAMP,
                game_length_seconds INTEGER,
                map_name TEXT,
                game_version TEXT,
                build_number INTEGER,
                expansion TEXT,
                game_type TEXT,
                game_speed TEXT,
                region TEXT,

                -- Players
                player1_name TEXT,
                player1_race TEXT,
                player2_name TEXT,
                player2_race TEXT,
                result INTEGER CHECK (result IS NULL OR result IN (1, 2)),

                -- Pro replay flag
                is_pro_replay BOOLEAN DEFAULT FALSE
            )
        """)

        # Create snapshots table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS snapshots (
                id SERIAL PRIMARY KEY,
                game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
                game_time_seconds INTEGER,
                player_number INTEGER CHECK (player_number IN (1, 2)),
                race TEXT,

                -- Economy
                worker_count INTEGER CHECK (worker_count >= 0),
                mineral_collection_rate REAL,
                gas_collection_rate REAL,
                unspent_minerals INTEGER,
                unspent_gas INTEGER,
                total_minerals_collected INTEGER,
                total_gas_collected INTEGER,

                -- Army
                army_value_minerals INTEGER CHECK (army_value_minerals >= 0),
                army_value_gas INTEGER CHECK (army_value_gas >= 0),
                army_supply INTEGER,
                units TEXT,  -- JSON

                -- Buildings
                buildings TEXT,  -- JSON

                -- Upgrades
                upgrades TEXT,  -- JSON

                -- Map Control
                base_count INTEGER,
                vision_area REAL,

                -- Combat/Efficiency
                units_killed_value INTEGER,
                units_lost_value INTEGER,
                resources_spent_minerals INTEGER,
                resources_spent_gas INTEGER,
                collection_efficiency REAL,
                spending_efficiency REAL,

                UNIQUE(game_id, game_time_seconds, player_number)
            )
        """)

        # Create build_order_events table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS build_order_events (
                id SERIAL PRIMARY KEY,
                game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
                player_number INTEGER CHECK (player_number IN (1, 2)),
                event_type TEXT CHECK (event_type IN ('building', 'unit', 'upgrade')),
                item_name TEXT NOT NULL,
                game_time_seconds INTEGER NOT NULL,
                is_milestone BOOLEAN DEFAULT FALSE,

                UNIQUE(game_id, player_number, event_type, item_name, game_time_seconds)
            )
        """)

        # Create indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_game_time ON snapshots(game_id, game_time_seconds)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_player ON snapshots(game_id, player_number)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_build_order_game ON build_order_events(game_id, player_number)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_build_order_milestones ON build_order_events(is_milestone)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_games_is_pro_replay ON games(is_pro_replay)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_games_matchup ON games(player1_race, player2_race)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_snapshots_game_player_time ON snapshots(game_id, player_number, game_time_seconds)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_games_pro_matchup ON games(is_pro_replay, player1_race, player2_race)")

        logger.info("Database initialized successfully")


def delete_game_by_replay_file(conn, replay_file: str, commit: bool = True) -> bool:
    """Delete a game and all its related data by replay_file."""
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM games WHERE replay_file = %s", (replay_file,))
    result = cursor.fetchone()

    if result is None:
        return False

    game_id = result[0]
    cursor.execute("DELETE FROM build_order_events WHERE game_id = %s", (game_id,))
    cursor.execute("DELETE FROM snapshots WHERE game_id = %s", (game_id,))
    try:
        cursor.execute("DELETE FROM user_uploads WHERE game_id = %s", (game_id,))
    except psycopg2.errors.UndefinedTable:
        conn.rollback()  # Clear the error state
    cursor.execute("DELETE FROM games WHERE id = %s", (game_id,))

    if commit:
        conn.commit()
    return True


def insert_game(conn, game_data: Dict[str, Any], commit: bool = True) -> int:
    """Insert a game record. Returns the game_id."""
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO games (
            replay_file, game_date, game_length_seconds, map_name,
            game_version, build_number, expansion, game_type, game_speed, region,
            player1_name, player1_race, player2_name, player2_race, result,
            is_pro_replay
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        game_data['replay_file'],
        game_data.get('game_date'),
        game_data['game_length_seconds'],
        game_data['map_name'],
        game_data.get('game_version'),
        game_data.get('build_number'),
        game_data.get('expansion'),
        game_data.get('game_type'),
        game_data.get('game_speed'),
        game_data.get('region'),
        game_data['player1_name'],
        game_data['player1_race'],
        game_data['player2_name'],
        game_data['player2_race'],
        game_data['result'],
        game_data.get('is_pro_replay', False)
    ))

    game_id = cursor.fetchone()[0]
    if commit:
        conn.commit()
    return game_id


def insert_snapshots(conn, game_id: int, snapshots: List[Dict[str, Any]], commit: bool = True) -> None:
    """Insert snapshot records."""
    cursor = conn.cursor()
    for s in snapshots:
        cursor.execute("""
            INSERT INTO snapshots (
                game_id, game_time_seconds, player_number, race,
                worker_count, mineral_collection_rate, gas_collection_rate,
                unspent_minerals, unspent_gas, total_minerals_collected, total_gas_collected,
                army_value_minerals, army_value_gas, army_supply, units,
                buildings, upgrades,
                base_count, vision_area,
                units_killed_value, units_lost_value,
                resources_spent_minerals, resources_spent_gas,
                collection_efficiency, spending_efficiency
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            game_id,
            s['game_time_seconds'], s['player_number'], s['race'],
            s['worker_count'], s['mineral_collection_rate'], s['gas_collection_rate'],
            s['unspent_minerals'], s['unspent_gas'],
            s['total_minerals_collected'], s['total_gas_collected'],
            s['army_value_minerals'], s['army_value_gas'], s['army_supply'], s['units'],
            s['buildings'], s['upgrades'],
            s['base_count'], s['vision_area'],
            s['units_killed_value'], s['units_lost_value'],
            s['resources_spent_minerals'], s['resources_spent_gas'],
            s['collection_efficiency'], s['spending_efficiency']
        ))

    if commit:
        conn.commit()


def insert_build_order_events(conn, game_id: int, player_number: int, events: List[Dict[str, Any]], commit: bool = True) -> None:
    """Insert build order events."""
    cursor = conn.cursor()
    for event in events:
        cursor.execute("""
            INSERT INTO build_order_events (
                game_id, player_number, event_type, item_name, game_time_seconds, is_milestone
            ) VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
        """, (
            game_id, player_number,
            event['event_type'], event['item_name'],
            event['game_time_seconds'], event.get('is_milestone', False)
        ))

    if commit:
        conn.commit()
```

**Step 2: Verify syntax**

Run: `cd /home/eduardo/Documents/repos/sc2gameanalizer && uv run --project backend python -c "import backend.src.database; print('Import OK')"`
Expected: Import OK (no syntax errors — will fail on missing DATABASE_URL at runtime, that's fine)

**Step 3: Commit**

```bash
git add backend/src/database.py
git commit -m "feat: rewrite database.py for PostgreSQL with connection pooling"
```

---

## Task 3: Migrate auth.py to PostgreSQL

**Files:**
- Modify: `backend/api/auth.py`

**Key changes:**
- Replace `import sqlite3` with `import psycopg2`
- Replace all `?` placeholders with `%s`
- Replace `sqlite3.IntegrityError` with `psycopg2.IntegrityError`
- Replace `cursor.lastrowid` with `RETURNING id`
- Replace `get_connection(db_path)` calls with new `get_connection()` context manager or `get_connection_direct()`
- Replace `BEGIN EXCLUSIVE` with standard `BEGIN`
- Replace `AUTOINCREMENT` with `SERIAL` in table creation
- Replace `INSERT OR IGNORE` with `INSERT ... ON CONFLICT DO NOTHING`
- Replace `BOOLEAN DEFAULT 0` with `BOOLEAN DEFAULT FALSE`
- Replace `DEFAULT CURRENT_TIMESTAMP` — works in both, keep as-is

**Step 1: Read full auth.py and make all replacements**

See appendix A for the full list of line-by-line changes needed. The general pattern:

1. `import sqlite3` → `import psycopg2` + `import psycopg2.errors`
2. `from backend.src.database import get_connection` → `from backend.src.database import get_connection, get_connection_direct, return_connection`
3. Every `get_connection(db_path)` → `get_connection_direct()` (for functions needing manual transaction control) or use `with get_connection() as conn:` context manager
4. Every `?` → `%s`
5. Every `cursor.lastrowid` → add `RETURNING id` to INSERT, then `cursor.fetchone()[0]`
6. Every `sqlite3.IntegrityError` → `psycopg2.IntegrityError`
7. Every `conn.close()` → `return_connection(conn)`

**Step 2: Verify import**

Run: `uv run --project backend python -c "import backend.api.auth; print('Import OK')"`
Expected: Fails on JWT_SECRET_KEY (expected), not on syntax

**Step 3: Commit**

```bash
git add backend/api/auth.py
git commit -m "feat: migrate auth.py from SQLite to PostgreSQL"
```

---

## Task 4: Migrate main.py to PostgreSQL

**Files:**
- Modify: `backend/api/main.py`

**Key changes:**
- Replace `import sqlite3` with `import psycopg2`
- Replace `conn.row_factory = sqlite3.Row` with psycopg2 DictCursor or manual dict conversion
- Replace all `?` placeholders with `%s` (~40+ occurrences)
- Replace all `get_connection(DB_PATH)` with new connection pattern
- Replace `init_database(DB_PATH)` with `init_database()` (no path arg)
- Update startup event to use `init_pool()` and `init_database()`
- Update `DB_PATH` references to use `DATABASE_URL`
- Update dynamic placeholder generation: `','.join('?' * n)` → `','.join('%s' * n)`

**Step 1: Make all replacements in main.py**

Focus areas:
- Startup event (~line 340): Replace DB_PATH init with pool init
- Every endpoint that calls `get_connection(DB_PATH)`: Replace with context manager
- `_row_to_snapshot()` function: Keep as-is (works with tuple rows)
- All SQL queries: `?` → `%s`

**Step 2: Verify import**

Run: `uv run --project backend python -c "from backend.api.main import app; print('App created')"`

**Step 3: Commit**

```bash
git add backend/api/main.py
git commit -m "feat: migrate main.py from SQLite to PostgreSQL"
```

---

## Task 5: Migrate similarity.py and ml_similarity.py to PostgreSQL

**Files:**
- Modify: `backend/api/similarity.py`
- Modify: `backend/api/ml_similarity.py`

**Key changes for both:**
- Replace `get_connection(db_path)` with new `get_connection()` context manager
- Replace all `?` with `%s`
- Replace dynamic `','.join('?' * n)` with `','.join(['%s'] * n)`

**Step 1: Update similarity.py**

**Step 2: Update ml_similarity.py**

**Step 3: Verify imports**

Run: `uv run --project backend python -c "import backend.api.similarity; import backend.api.ml_similarity; print('OK')"`

**Step 4: Commit**

```bash
git add backend/api/similarity.py backend/api/ml_similarity.py
git commit -m "feat: migrate similarity modules from SQLite to PostgreSQL"
```

---

## Task 6: Migrate crypto_payments.py to PostgreSQL

**Files:**
- Modify: `backend/api/crypto_payments.py`

**Key changes:**
- Replace `sqlite_master` queries with `information_schema.tables`
- Replace `PRAGMA table_info()` with `information_schema.columns`
- Replace all `?` with `%s`
- Replace `AUTOINCREMENT` with `SERIAL`
- Replace `cursor.lastrowid` with `RETURNING id`
- Rewrite table migration/introspection logic for PostgreSQL

**Step 1: Make all replacements**

**Step 2: Verify import**

**Step 3: Commit**

```bash
git add backend/api/crypto_payments.py
git commit -m "feat: migrate crypto_payments.py from SQLite to PostgreSQL"
```

---

## Task 7: Migrate remaining files (parser.py, generate.py, validate.py, scripts)

**Files:**
- Modify: `backend/src/parser.py`
- Modify: `backend/src/generate.py`
- Modify: `backend/src/validate.py`
- Modify: `backend/scripts/import_pro_replays.py` (if exists)

**Key changes:**
- Same pattern: `?` → `%s`, sqlite3 → psycopg2, connection management
- `generate.py` and `validate.py`: Update to use `DATABASE_URL` instead of file paths

**Step 1-3: Update each file, verify, commit**

```bash
git add backend/src/parser.py backend/src/generate.py backend/src/validate.py backend/scripts/
git commit -m "feat: migrate parser, generate, validate scripts to PostgreSQL"
```

---

## Task 8: Create backend Dockerfile

**Files:**
- Create: `backend/Dockerfile`

**Step 1: Create the Dockerfile**

```dockerfile
FROM python:3.13-slim

WORKDIR /app

# Install system dependencies for psycopg2
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency management
RUN pip install --no-cache-dir uv

# Copy dependency files first for layer caching
COPY pyproject.toml uv.lock ./

# Install Python dependencies
RUN uv sync --frozen --no-dev

# Copy application code
COPY . .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--timeout-keep-alive", "30"]
```

**Step 2: Verify Dockerfile builds locally (optional)**

Run: `cd backend && docker build -t sc2-backend .`

**Step 3: Commit**

```bash
git add backend/Dockerfile
git commit -m "feat: add backend Dockerfile for ContainerDuck deployment"
```

---

## Task 9: Create frontend Dockerfile

**Files:**
- Create: `frontend/Dockerfile`

**Step 1: Create the Dockerfile**

```dockerfile
FROM node:20-slim AS build

WORKDIR /app

# Copy dependency files first for layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .

# VITE_API_URL is baked at build time
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

RUN npm install -g serve

COPY --from=build /app/dist ./dist

EXPOSE 8091

CMD ["serve", "-s", "dist", "-l", "8091"]
```

**Step 2: Commit**

```bash
git add frontend/Dockerfile
git commit -m "feat: add frontend Dockerfile for ContainerDuck deployment"
```

---

## Task 10: Update frontend ApiClient for configurable API URL

**Files:**
- Modify: `frontend/src/api/client.ts`

**Key change:** Ensure `VITE_API_URL` is used as the base URL when set, falling back to relative `/api` for local dev.

**Step 1: Verify current behavior and update if needed**

The ApiClient should use `import.meta.env.VITE_API_URL` when available. Check current implementation and ensure it works with the env var.

**Step 2: Commit if changes made**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: support VITE_API_URL for deployed environments"
```

---

## Task 11: Update tests for PostgreSQL

**Files:**
- Modify: `backend/tests/test_database.py`
- Modify: any other test files using sqlite3

**Key changes:**
- Tests need a PostgreSQL instance to run against
- Replace temp SQLite files with test database setup/teardown
- Replace `sqlite3.IntegrityError` with `psycopg2.IntegrityError`
- Add `TEST_DATABASE_URL` env var support

**Step 1: Update test infrastructure**

**Step 2: Run tests**

Run: `uv run --project backend pytest backend/tests/ -v`

**Step 3: Commit**

```bash
git add backend/tests/
git commit -m "feat: update tests for PostgreSQL"
```

---

## Task 12: Create qa branch, push to GitHub

**Step 1: Ensure all changes are committed on main**

Run: `git status` — should be clean

**Step 2: Create and push qa branch**

```bash
git checkout -b qa
git push -u origin qa
git checkout main
```

---

## Task 13: Deploy backend to QA on ContainerDuck

**Via ContainerDuck UI:**

1. Navigate to SC2GameAnalyzer - QA project
2. Click "Add App" → Custom App
3. Configure:
   - Name: `backend-qa`
   - Repo: `edlgg/sc2gameanalizer`
   - Branch: `qa`
   - Subdirectory: `backend`
   - Build method: `dockerfile`
   - Port: `8000`
4. Set environment variables:
   - `DATABASE_URL` = (get from QA PostgreSQL "Connect" page)
   - `JWT_SECRET_KEY` = (generate secure 32+ char key)
   - `CORS_ORIGINS` = `https://frontend-qa.07b82bb5023c40449356707d8026c7d0.apps.containerduck.com`
5. Deploy

---

## Task 14: Update QA frontend configuration

**Via ContainerDuck UI:**

1. Navigate to frontend-qa app settings
2. Update branch from `main` to `qa`
3. Update port from `5173` to `8091`
4. Add environment variable:
   - `VITE_API_URL` = `https://backend-qa.07b82bb5023c40449356707d8026c7d0.apps.containerduck.com`
5. Redeploy

---

## Task 15: Test QA end-to-end

1. Open frontend-qa URL in browser
2. Verify landing page loads
3. Register a user
4. Upload a replay file
5. Verify snapshot generation works
6. Check comparison dashboard

---

## Task 16: Deploy Prod environment

**Via ContainerDuck UI:**

Repeat for Prod project (`78f71afd...`):

1. Install PostgreSQL catalog app
2. Deploy backend (branch: `main`, same config as QA but prod URLs)
3. Deploy frontend (branch: `main`, VITE_API_URL pointing to prod backend)
4. Seed pro replays data

---

## Summary

| Task | Description | Estimated Effort |
|------|-------------|-----------------|
| 1 | Add psycopg2 dependency | 2 min |
| 2 | Rewrite database.py | 15 min |
| 3 | Migrate auth.py | 15 min |
| 4 | Migrate main.py | 20 min |
| 5 | Migrate similarity modules | 10 min |
| 6 | Migrate crypto_payments.py | 15 min |
| 7 | Migrate remaining files | 10 min |
| 8 | Backend Dockerfile | 5 min |
| 9 | Frontend Dockerfile | 5 min |
| 10 | Update ApiClient | 5 min |
| 11 | Update tests | 15 min |
| 12 | Create qa branch | 2 min |
| 13 | Deploy backend to QA | 10 min (UI) |
| 14 | Update QA frontend | 5 min (UI) |
| 15 | Test QA e2e | 10 min |
| 16 | Deploy Prod | 15 min (UI) |

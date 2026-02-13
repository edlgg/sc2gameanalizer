# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SC2 Replay Analyzer — a web app that parses StarCraft II replay files and compares user gameplay against professional players. Users upload `.SC2Replay` files, the backend parses them into 5-second snapshots, then finds similar pro games and renders rich comparison dashboards.

## Commands

All commands use `task` (go-task runner). The Taskfile loads `backend/.env` automatically.

```bash
task install          # Install all deps (uv sync + npm install)
task install-dev      # Include dev deps (pytest, etc.)
task backend          # FastAPI dev server on :8003 (with --reload)
task frontend         # Vite dev server on :5173 (proxies /api to :8003)
task test             # pytest backend/tests/ -v
task build            # Production frontend build (tsc + vite build)
task generate         # Parse all replays in data/ into snapshot DB
task validate         # Validate snapshot DB integrity
task init-db          # Create empty DB tables
task clean            # Delete generated databases
task download         # Fetch pro replays from spawningtool.com
task user-approve EMAIL=user@example.com  # Upgrade user to Pro (bypass payment)
```

Run a single test:
```bash
uv run --project backend pytest backend/tests/test_parser.py -v
uv run --project backend pytest backend/tests/test_parser.py::test_name -v
```

Frontend lint:
```bash
cd frontend && npm run lint
```

## Architecture

**Monorepo** with two apps:

### Backend (Python 3.13+ / FastAPI)
- **Entry point**: `backend/api/main.py` — single file with all endpoints (~1400 lines, no router split)
- **Core modules** in `backend/src/`:
  - `parser.py` — wraps `sc2reader` to extract game metadata + per-player events
  - `snapshot.py` — `GameState` class that processes replay events into snapshots every 5 seconds (tracks 26 metrics: workers, army value, resources, bases, etc.)
  - `database.py` — schema definition (CREATE IF NOT EXISTS) and insert/query functions. **No ORM** — direct `sqlite3` module usage
  - `constants.py` — SC2 unit costs, race mappings, building lists
  - `generate.py` / `validate.py` — batch processing and validation scripts
- **API modules** in `backend/api/`:
  - `auth.py` — JWT auth (python-jose), user/subscription management, upload quotas
  - `similarity.py` — rule-based matchup + macro pattern matching
  - `ml_similarity.py` — sklearn-based embedding similarity with caching
  - `crypto_payments.py` — Web3 integration for crypto payments (Polygon/Ethereum/Arbitrum)
- **Database**: SQLite3 at `backend/data/replays.db`
  - Tables: `games`, `snapshots`, `build_order_events`, `users`, `user_uploads`, `payments`
  - `snapshots` has a UNIQUE constraint on `(game_id, game_time_seconds, player_number)`
  - `user_uploads` is a junction table for multi-user game ownership
  - `games.is_pro_replay` boolean distinguishes pro vs user-uploaded games
- **Package management**: `uv` with `backend/pyproject.toml`

### Frontend (React 19 / TypeScript / Vite)
- **Entry**: `frontend/src/App.tsx` — view-state based routing (upload/library/comparison), no router library
- **State management**: React Query (`@tanstack/react-query`) for server state, `AuthContext` for auth
- **API layer**: `frontend/src/api/client.ts` — singleton `ApiClient` class, JWT in localStorage, auto-detects Tailscale proxy
- **Hooks**: `frontend/src/hooks/useGames.ts` — React Query wrappers for all API calls
- **Components**: `frontend/src/components/` — flat structure with `charts/` subdirectory for Recharts components
- **Styling**: Tailwind CSS 3.4 with custom colors (`sc2-blue`, `sc2-purple`), dark theme throughout
- **Charts**: Recharts for timelines/deltas, `@nivo/sankey` for flow diagrams

### Data Flow
1. User uploads `.SC2Replay` → backend parses with `sc2reader` → `GameState` generates snapshots every 5s
2. Game metadata + snapshots + build order events stored in SQLite
3. Similarity engine finds matching pro games by matchup + macro patterns
4. Frontend fetches snapshots for user game + pro games, renders comparison charts

## Environment Variables

Required in `backend/.env`:
- `JWT_SECRET_KEY` — 32+ char secret for JWT tokens
- `WALLET_SEED_PHRASE` — BIP39 mnemonic (only needed for crypto payment features)

Optional:
- `PRO_PRICE_USD` — Pro tier price (default: 29.99)
- `SUPPORT_EMAIL` — Shown for payment issues
- `DATABASE_PATH` — Override default `data/replays.db`

## Key Patterns

- **Subscription tiers**: Free (3 uploads/month) vs Pro (unlimited). Enforced in `auth.py:can_upload()`
- **Snapshot granularity**: One row per player per 5-second interval. A 20-minute game = ~480 snapshot rows (2 players × 240 intervals)
- **Race matching**: When comparing pro vs user snapshots, the API matches by race (your Zerg vs pro's Zerg player), not by player number
- **Rate limiting**: In-memory token bucket in `main.py` (not persistent across restarts)
- **Vite proxy**: Dev frontend proxies `/api/*` to `localhost:8003` — no CORS issues in dev

# SC2 Replay Analyzer - Design Document

**Date:** 2026-01-15
**Target Users:** Diamond and Master level SC2 players
**Business Model:** Dual deployment - Desktop (one-off purchase) + SaaS Web (subscription)

## Overview

A tool that helps SC2 players identify gaps in their build execution and strategy by comparing their replays against a curated database of professional games. The app provides visual, actionable feedback on economic efficiency, build precision, army composition, and strategic decisions.

## Architecture

### High-Level Components

**Three-Layer Architecture:**

1. **Python Backend (FastAPI)**
   - Replay parsing using sc2reader library
   - Data extraction and transformation
   - Analysis engine (similarity matching, gap detection)
   - Built-in database of pre-analyzed pro replays

2. **React Frontend**
   - Interactive dashboard with Recharts/D3 visualizations
   - Three main modes: Single Game Analysis, Batch Analysis, Practice Mode
   - Real-time feedback during processing

3. **Deployment Wrappers**
   - Desktop: PyWebView packages Python backend + React frontend into native app
   - Web: FastAPI deployed to cloud + React on CDN

### Data Flow

```
User uploads replay(s)
  ↓
Python parses with sc2reader
  ↓
Extracts build-events and snapshots (every 5 seconds)
  ↓
Matches against pro database using build signature (first 8 minutes)
  ↓
Generates comparison metrics
  ↓
Frontend renders interactive visualizations
  ↓
Gap analysis algorithm produces recommendations
  ↓
User sees results
```

### Storage

**Desktop:** SQLite database (~50-100MB) bundled with installer
**Web:** PostgreSQL with user accounts and cloud storage

## Data Models

### Build Events Table
Records every significant game action with precise timing.

```sql
build_events:
  - id (primary key)
  - game_id (foreign key to games)
  - game_time (seconds, e.g., 180 for 3:00)
  - event_type (enum: 'unit', 'building', 'upgrade')
  - name (e.g., 'Stalker', 'Gateway', 'WarpGate')
  - count (units produced in this batch)
  - supply_used (current supply at this moment)
  - resources_spent (cumulative minerals + gas * 1.5)
  - location (x, y coordinates for buildings/expansions)
```

### Snapshots Table
Game state captured every 5 seconds for trend analysis.

```sql
snapshots:
  - id (primary key)
  - game_id (foreign key)
  - game_time (seconds: 0, 5, 10, 15...)
  - worker_count (probes/drones/SCVs)
  - army_value (total resource value of army units)
  - army_supply (supply used by army, excluding workers)
  - mineral_collection_rate (current rate/minute)
  - gas_collection_rate (current rate/minute)
  - unspent_resources (minerals + gas sitting in bank)
  - bases_count (active command structures)
  - upgrade_progress (bitmask or count of completed upgrades)
```

### Pro Games Metadata
Pre-computed signatures for fast matching.

```sql
pro_games:
  - id (primary key)
  - player_name, opponent_name
  - matchup (e.g., 'PvT', 'ZvZ')
  - patch_version (e.g., '5.0.11')
  - build_signature (JSON: key buildings/units in first 8 minutes)
  - build_label (optional human name: '4-Gate Blink')
  - avg_worker_at_6min, avg_army_value_at_8min, etc.
```

**Build Signature Example:**
```json
{
  "Gateway": [120, 145],
  "CyberCore": [150],
  "Stalker": [180, 195, 210],
  "Twilight": [240]
}
```

## User Modes

### Mode 1: Single Game Analysis
- User drags/drops one `.SC2Replay` file
- App parses replay, extracts events + snapshots
- Matches build signature against pro database (first 8 minutes)
- Shows top 5 most similar pro games
- Displays side-by-side timeline comparison (user vs pro average)
- Gap analysis highlights top 3-5 actionable improvements
- User can drill into specific time ranges or metrics

### Mode 2: Batch Analysis (Trend Detection)
- User uploads 10-20 recent games
- App identifies patterns: "You're consistently 8 workers behind at 6:00 in PvT"
- Shows aggregate metrics: average worker count curve, common bottlenecks
- Tracks improvement over time if games are dated
- Highlights which matchups need most work

### Mode 3: Practice Mode
- User browses pro game database, selects a specific build to practice
- App shows the "perfect" benchmark: timing for each building/unit/upgrade
- User uploads their practice attempts
- App shows precision score: how close they matched each timing
- Gamified with checkmarks, color coding (green < 5s off, yellow < 10s, red > 10s)

## Build Similarity Matching

### Build Signature Extraction
For the first 8 minutes (480 seconds) of each game, extract:
- All building completions with timestamps
- All unit productions with timestamps
- All upgrade starts with timestamps
- Key ratios: worker count at 4min, 6min, 8min

### Similarity Scoring Process

1. **Filter by matchup** - Only compare same matchups (PvT, ZvZ, etc.)

2. **Race-specific key events:**
   - **Protoss:** Gateway, Cyber Core, Nexus, key tech (Robo/Stargate/Twilight)
   - **Terran:** Barracks, Factory, Starport, CC, key units (Marines, Tanks, Medivacs)
   - **Zerg:** Hatchery, Lair, Den/Pool, key units (Roaches, Hydras, Mutas)

3. **Calculate distance score** for each pro game:
   - For each key event type, compare timing differences
   - Weight earlier events more heavily (first Gateway timing matters more than 5th)
   - Formula: `score = sum(weight[i] * |user_time[i] - pro_time[i]|)`
   - Lower score = more similar

4. **Return top 5 matches** with similarity percentage

5. **Aggregate pro baseline:** Average the snapshots from top 5 similar pro games to create the comparison benchmark

## Visualizations

### Primary Dashboard (Single Game Analysis)

**1. Game Header Card**
- Your game: Player name, race, vs opponent (race), map, date, result
- Matched to: "5 similar pro games" with similarity score
- Quick stats: game length, APM, final worker count

**2. Side-by-Side Timeline Charts** (main visualization)
- Two synchronized line charts stacked vertically
- Top: Your game | Bottom: Pro average
- Metrics toggleable: Worker count, Army value, Income rate, Unspent resources
- Scrubber bar to zoom into time ranges
- Hover shows exact values + delta at that timestamp
- Color coding: user line (blue), pro line (gold/orange)

**3. Build Order Timeline** (horizontal gantt-style)
- Shows buildings/units/upgrades as bars on timeline
- User buildings above, pro buildings below
- Color indicates timing accuracy: green (< 5s), yellow (5-10s), red (> 10s)
- Click to see exact timestamps

**4. Gap Analysis Panel** (right sidebar)
- Top 3-5 gaps ranked by impact
- Each shows: metric name, your value, pro value, difference, timestamp
- Specific recommendation text
- Clicking a gap highlights it on the timeline

**5. Metric Cards** (summary stats)
- Worker count at 6min, 8min, 10min
- Average unspent resources
- First 3 base timings
- Key upgrade timings

### Batch Analysis View
- Aggregate line charts showing average across all uploaded games
- Heatmap: matchups (rows) vs metrics (columns), colored by performance gap
- Improvement trend if games span time period

### Practice Mode View
- Checklist interface with target timings
- Live progress bar showing completion percentage
- Split view: target vs attempt

## Gap Analysis Algorithm

### Gap Detection Logic

**1. Economic Gaps:**
- Worker deficit: Compare worker_count at key timestamps (4min, 6min, 8min)
- Income efficiency: mineral/gas collection rate compared to worker count
- Resource banking: excessive unspent_resources (> 1000 for > 30 seconds)
- Expansion timing: bases_count at 5min, 8min, 10min benchmarks

**2. Build Precision Gaps:**
- For each key building/unit in build signature, calculate timing delta
- Identify which events were > 15 seconds late
- Check for missing buildings/units that pros had

**3. Army Composition Gaps:**
- Compare army_value trajectory - identify when you fell behind
- Unit mix comparison if data available
- Tech timing gaps (upgrades completed late)

**4. Strategic Gaps:**
- Supply blocks: detect when supply_used plateaus while unspent resources high
- Army trading efficiency: drops in army_value vs opponent

### Prioritization & Recommendations

**Impact Score Formula:**
```
impact = magnitude * duration * phase_weight
```
- **magnitude:** how far off from pro baseline
- **duration:** how long the gap persisted
- **phase_weight:** early game (< 8min) = 2x, mid-game = 1.5x, late-game = 1x

**Recommendation Examples:**
- "Build 3rd Nexus by 5:15 (you built at 6:00, 45s late)"
- "Maintain 60 workers by 8:00 (you had 52, 8 workers behind)"
- "You were supply blocked 4 times for total 35 seconds between 6:00-10:00"
- "Your army value dropped 3000 resources behind after engagement at 9:30"

Show top 3 recommendations prominently, rest in expandable list.

## Technology Stack

### Backend
- Python 3.11+
- FastAPI (async API framework)
- sc2reader (replay parsing)
- SQLite (desktop) / PostgreSQL (web)
- SQLAlchemy (ORM)
- Pydantic (data validation)
- NumPy/Pandas (data processing)

### Frontend
- React 18+
- TypeScript
- Vite (build tool)
- Recharts (primary charting)
- D3.js (custom visualizations)
- TailwindCSS (styling)
- React Query (API state management)

### Desktop Wrapper
- PyWebView (native window wrapper)

### Development Tools
- Taskfile (orchestration)
- Pytest (unit tests - table-driven)
- Playwright (E2E tests + QA via MCP)
- Ruff (Python linting/formatting)
- ESLint + Prettier (TypeScript/React)

## Project Structure

```
sc2gameanalizer/
├── backend/
│   ├── api/              # FastAPI routes
│   ├── core/             # Business logic (parsing, analysis, matching)
│   ├── models/           # SQLAlchemy models
│   ├── schemas/          # Pydantic schemas
│   ├── db/               # Database utilities
│   │   ├── base.py       # DB abstraction layer
│   │   ├── sqlite.py     # Desktop mode
│   │   └── postgres.py   # Web mode
│   ├── auth/             # Web-only: user accounts
│   ├── tests/            # Pytest unit tests
│   ├── config.py         # Environment-based config
│   └── main.py           # FastAPI app entry
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Main views (Single, Batch, Practice)
│   │   ├── hooks/        # Custom React hooks
│   │   ├── api/          # API client
│   │   │   ├── client.ts
│   │   │   └── config.ts # Switches localhost/cloud
│   │   └── types/        # TypeScript types
│   └── tests/            # Frontend unit tests
├── tests/
│   └── e2e/              # Playwright E2E tests
├── data/
│   ├── replays/          # Source pro replays (not in git/distribution)
│   └── pro_games.db      # Pre-processed database (ships with app)
├── desktop/              # PyWebView packaging
├── deploy/
│   ├── web/              # Docker, cloud deployment configs
│   └── desktop/          # Installer builders
├── Taskfile.yml          # Task orchestration
└── docs/
    └── plans/            # Design documents
```

## Taskfile Commands

- `task setup` - Install dependencies (Python venv, npm install)
- `task generate` - Process replays from data/replays/ into pro_games.db
- `task run` - Start backend + frontend dev servers (desktop mode)
- `task run:web` - Local dev (web mode with PostgreSQL)
- `task test-unit` - Run pytest + vitest unit tests
- `task test-e2e` - Run Playwright E2E suite
- `task build:desktop` - Package desktop executable
- `task build:web` - Build for cloud deployment
- `task deploy:web` - Deploy to cloud
- `task lint` - Run all linters

## Dual Deployment Strategy

### Desktop Version (One-off Purchase)
- PyWebView packages everything into executable
- FastAPI runs on localhost:8000
- SQLite bundled with installer (~50-100MB)
- 100% local, no internet required after install
- Distribution: Executable installers for Windows/Mac/Linux

### SaaS Web Version (Subscription)
- FastAPI deployed to cloud (Railway, Render, AWS)
- React static build on Vercel/Netlify
- PostgreSQL (multi-user, user accounts)
- User replays + pro database in cloud
- Auth: User accounts, JWT tokens, subscription management
- Distribution: Users access via web browser

### Code Sharing
Same codebase supports both with minimal differences:
- Database layer: SQLite vs PostgreSQL (SQLAlchemy abstraction)
- Auth layer: Desktop = no auth, Web = JWT + sessions
- File uploads: Desktop = file system, Web = multipart upload
- Config: Environment variables switch between modes

## Development Approach

### Principles
- **Data-driven programming:** Use table-driven tests and configuration
- **Clean, DRY, modular code:** Break up into small functions, refactor as needed
- **Simple commands:** Rely on Taskfile, avoid complex bash gymnastics
- **Test everything:**
  - Unit tests: Table-driven, specific test cases (pytest + vitest)
  - E2E tests: Happy path scenarios (Playwright)
  - QA-style testing: Use Playwright MCP to test like a human

### Pro Replay Data Generation
- Developer downloads pro replays manually to `data/replays/`
- Run `task generate` to process all replays into `data/pro_games.db`
- Database file ships with application (replays do NOT ship)
- Updates: New replay packs → regenerate database → ship in app update

## Next Steps

1. Set up project structure and Taskfile
2. Implement backend replay parser (sc2reader integration)
3. Build data extraction pipeline (events + snapshots)
4. Create database models and migrations
5. Implement similarity matching algorithm
6. Build FastAPI endpoints
7. Create React components and visualizations
8. Implement gap analysis logic
9. Add testing suite (unit + E2E)
10. Package desktop version
11. Deploy web version (phase 2)

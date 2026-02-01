# SC2 Game Analyzer - Complete Workflow

## Overview
This document describes the complete workflow for downloading, processing, and analyzing SC2 replays.

## 1. Download Replays from spawningtool.com

Download SC2 replays from the spawningtool.com replay database:

```bash
# Download 5 pages (~125 replays) - default
task download

# Download custom number of pages
task download PAGES=10

# With custom delay between downloads (seconds)
task download PAGES=5 DELAY=1.0
```

**What it does:**
- Fetches replay list pages from `https://lotv.spawningtool.com/replays/`
- Downloads individual `.SC2Replay` files to `data/replays/`
- Skips files that already exist (safe to re-run)
- Uses pagination parameter `?p=N` for page 2+

**Expected output:**
```
============================================================
SC2 REPLAY DOWNLOADER - spawningtool.com
============================================================
Pages to download: 5
Output directory: data/replays
Delay between downloads: 0.5s

📄 Page 1/5
  Found 25 replays
  Replay 89174: ✓ Downloaded (replay_89174.SC2Replay)
  ...
============================================================
DOWNLOAD COMPLETE
============================================================
Total replays found: 125
Downloaded: 100
Skipped (already exist): 25
Output directory: data/replays
============================================================
```

## 2. Generate Database from Replays

Parse all replay files and create the snapshot database:

```bash
task generate
```

**What it does:**
- Scans `data/replays/` for all `.SC2Replay` files
- Parses each replay using `sc2reader` library
- Extracts game metadata (players, races, map, winner)
- Generates snapshots every 5 seconds for both players
- Stores structured data in `data/replays.db` SQLite database
- **Automatically skips:**
  - Non-1v1 games (team games, FFA, archon mode, etc.)
  - Games against AI/Computer opponents
  - Games shorter than 60 seconds
  - Corrupted or unparseable replay files

**Expected output:**
```
Initializing database at data/replays.db...
Found 129 replay files

[1/129] Processing replay_89174.SC2Replay... ✓
[2/129] Processing replay_89173.SC2Replay... ✓
[3/129] Processing replay_89048.SC2Replay... ⏭️  SKIP: Not a 1v1 game (found 6 players)
[4/129] Processing replay_89051.SC2Replay... ⏭️  SKIP: Corrupted/unparseable (IndexError)
...
============================================================
Processing complete!
  Total:      129
  Processed:  114
  Skipped:    15
  Database:   data/replays.db

Skipped replays:
  • replay_89048.SC2Replay: Not a 1v1 game (found 6 players)
  • replay_89051.SC2Replay: Corrupted/unparseable (IndexError)
  ...
============================================================
```

**Common skip reasons:**
- `Not a 1v1 game (found N players)` - Team game, FFA, or archon mode
- `Game against AI/Computer: PlayerName` - Replays vs AI opponents
- `Corrupted/unparseable (IndexError)` - Damaged replay file
- `Game too short (Ns < 60s)` - Games under 1 minute

## 3. Start Backend Server

Start the FastAPI backend that serves the database:

```bash
task backend
```

**What it does:**
- Starts FastAPI server on `http://0.0.0.0:8000`
- Serves REST API endpoints for games, snapshots, and comparisons
- Hot-reloads on code changes

**API endpoints:**
- `GET /games` - List all games
- `GET /games/{game_id}` - Get specific game details
- `GET /games/{game_id}/snapshots` - Get snapshots for a game
- `POST /compare` - Compare multiple games

## 4. Start Frontend Dev Server

In a **separate terminal**, start the React frontend:

```bash
task frontend
```

**What it does:**
- Starts Vite dev server on `http://localhost:5173`
- Connects to backend at `http://localhost:8000`
- Hot-reloads on code changes

## 5. View in Browser

Open your browser to:
```
http://localhost:5173
```

You should see:
- **Game Library**: Browse all processed replays
- **Upload Zone**: Upload your own replays for comparison
- **Comparison Dashboard**: Compare your games vs pro player averages

## Complete Workflow Commands

### Fresh Start (Clean Slate)
```bash
# Terminal 1
rm data/replays/*.SC2Replay  # Remove old replays
task download PAGES=10       # Download fresh replays
task clean                   # Remove old database
task generate                # Generate new database
task backend                 # Start backend

# Terminal 2
task frontend                # Start frontend
```

### Add More Replays
```bash
# Terminal 1
task download PAGES=5   # Downloads new, skips existing
task generate           # Re-parses all replays
# Backend restarts automatically if running with --reload

# No need to restart frontend - just refresh browser
```

### Regenerate Database Only
```bash
task clean      # Remove old database
task generate   # Rebuild from existing replays
```

## Taskfile Commands Reference

```bash
task download    # Download replays (5 pages default)
task generate    # Parse replays → database
task backend     # Start FastAPI server
task frontend    # Start React dev server
task clean       # Remove generated databases
task install     # Install all dependencies
task build       # Build frontend for production
task test        # Run pytest tests
```

## Database Schema

### games table
- Game metadata: players, races, map, winner, date
- 1 row per game

### snapshots table
- Game state snapshots every 5 seconds
- 2 snapshots per game per time interval (one per player)
- Tracks: workers, army value, units, buildings, upgrades

### build_order_events table
- Key build order events and timings
- Used for build order comparison

## Troubleshooting

### Backend won't start
- Check if port 8000 is in use: `lsof -i :8000`
- Make sure database exists: `ls -lh data/replays.db`

### Frontend can't connect to backend
- Verify backend is running on port 8000
- Check browser console for CORS errors
- Confirm `frontend/src/api/client.ts` points to correct URL

### No games showing up
- Check database has data: `uv run python -c "import sqlite3; print(sqlite3.connect('data/replays.db').execute('SELECT COUNT(*) FROM games').fetchone())"`
- Verify replays were processed: Check `task generate` output
- Refresh browser and check Network tab

### Downloads failing
- spawningtool.com may be down or blocking requests
- Try increasing delay: `task download PAGES=5 DELAY=2.0`
- Check internet connection

## File Locations

```
data/
├── replays/              # Downloaded .SC2Replay files
└── replays.db            # Generated SQLite database

scripts/
├── download_replays.py   # Download script
└── DOWNLOAD_TESTING_RESULTS.md  # Testing documentation

src/
├── generate.py           # Database generation entry point
├── parser.py             # Replay parsing logic
├── database.py           # Database operations
├── snapshot.py           # Snapshot extraction
└── build_order.py        # Build order analysis

backend/
└── main.py               # FastAPI backend server

frontend/
├── src/
│   ├── components/       # React components
│   ├── api/             # API client
│   └── types.ts         # TypeScript types
└── package.json

Taskfile.yml              # Task definitions
pyproject.toml            # Python dependencies
requirements.txt          # Python dependencies
```

"""
FastAPI backend for SC2 Replay Analyzer.
"""
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pathlib import Path
import tempfile
import shutil
import sqlite3
from typing import List, Dict, Any, Optional
import json

from src.parser import parse_replay_file
from src.database import init_database
from backend.similarity import find_similar_games

app = FastAPI(title="SC2 Replay Analyzer", version="1.0.0")

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://kit.tail993c4d.ts.net",
        # Allow any Tailscale domain
        "https://*.ts.net",
    ],
    allow_origin_regex=r"https://.*\.ts\.net",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database path
DB_PATH = Path(__file__).parent.parent / "data" / "replays.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# Upload directory for replay files
UPLOAD_DIR = Path(__file__).parent.parent / "data" / "replays"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup if it doesn't exist."""
    if not DB_PATH.exists():
        init_database(DB_PATH)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "SC2 Replay Analyzer API"}


@app.post("/api/upload")
async def upload_replay(file: UploadFile = File(...)):
    """
    Upload and parse a SC2 replay file.

    Args:
        file: The .SC2Replay file to upload

    Returns:
        Game metadata and ID of the parsed game
    """
    # Validate file extension
    if not file.filename.endswith('.SC2Replay'):
        raise HTTPException(status_code=400, detail="File must be a .SC2Replay file")

    # Save uploaded file directly to permanent storage first
    permanent_path = UPLOAD_DIR / file.filename
    with open(permanent_path, 'wb') as f:
        shutil.copyfileobj(file.file, f)

    try:
        # Parse the replay (using the permanent path so filename matches)
        parse_replay_file(permanent_path, DB_PATH)

        # Get the newly created game
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, replay_file, game_date, game_length_seconds, map_name,
                   player1_name, player1_race, player2_name, player2_race, result
            FROM games
            WHERE replay_file = ?
        """, (file.filename,))

        row = cursor.fetchone()
        conn.close()

        if not row:
            raise HTTPException(status_code=500, detail="Failed to retrieve parsed game")

        game = {
            "id": row[0],
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

        return {"success": True, "game": game}

    except ValueError as e:
        # Validation error (not 1v1, too short, etc.)
        # Delete the uploaded file since it's invalid
        permanent_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Delete the uploaded file on parsing error
        permanent_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Failed to parse replay: {str(e)}")


@app.get("/api/games")
async def get_games(
    is_pro: Optional[bool] = None,
    map_name: Optional[str] = None,
    race: Optional[str] = None
):
    """
    Get all games with optional filters.

    Args:
        is_pro: Filter for pro replays (True) or user replays (False)
        map_name: Filter by map name
        race: Filter by race (player1 or player2)

    Returns:
        List of games
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    query = """
        SELECT id, replay_file, game_date, game_length_seconds, map_name,
               player1_name, player1_race, player2_name, player2_race, result,
               is_pro_replay
        FROM games
        WHERE 1=1
    """
    params = []

    if is_pro is not None:
        query += " AND is_pro_replay = ?"
        params.append(1 if is_pro else 0)

    if map_name:
        query += " AND map_name LIKE ?"
        params.append(f"%{map_name}%")

    if race:
        query += " AND (player1_race = ? OR player2_race = ?)"
        params.append(race)
        params.append(race)

    query += " ORDER BY game_date DESC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

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

    return {"games": games}


@app.get("/api/games/{game_id}")
async def get_game(game_id: int):
    """
    Get detailed information about a specific game.

    Args:
        game_id: The game ID

    Returns:
        Game metadata
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, replay_file, game_date, game_length_seconds, map_name,
               player1_name, player1_race, player2_name, player2_race, result,
               is_pro_replay
        FROM games
        WHERE id = ?
    """, (game_id,))

    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Game not found")

    return {
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


@app.get("/api/games/{game_id}/snapshots")
async def get_snapshots(game_id: int, player_number: Optional[int] = None):
    """
    Get snapshots for a specific game.

    Args:
        game_id: The game ID
        player_number: Optional filter for player 1 or 2

    Returns:
        List of snapshots
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    query = """
        SELECT id, game_id, game_time_seconds, player_number, race,
               worker_count, mineral_collection_rate, gas_collection_rate,
               unspent_minerals, unspent_gas, total_minerals_collected, total_gas_collected,
               army_value_minerals, army_value_gas, army_supply, units,
               buildings, upgrades, base_count, vision_area, unit_map_presence,
               units_killed_value, units_lost_value,
               resources_spent_minerals, resources_spent_gas,
               collection_efficiency, spending_efficiency
        FROM snapshots
        WHERE game_id = ?
    """
    params = [game_id]

    if player_number:
        query += " AND player_number = ?"
        params.append(player_number)

    query += " ORDER BY game_time_seconds, player_number"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    snapshots = []
    for row in rows:
        snapshots.append({
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
            "units": json.loads(row[15]) if row[15] else {},
            "buildings": json.loads(row[16]) if row[16] else {},
            "upgrades": json.loads(row[17]) if row[17] else {},
            "base_count": row[18],
            "vision_area": row[19],
            "unit_map_presence": json.loads(row[20]) if row[20] else {},
            "units_killed_value": row[21],
            "units_lost_value": row[22],
            "resources_spent_minerals": row[23],
            "resources_spent_gas": row[24],
            "collection_efficiency": row[25],
            "spending_efficiency": row[26]
        })

    return {"snapshots": snapshots}


@app.get("/api/games/{game_id}/similar")
async def get_similar_games(game_id: int, limit: int = 3):
    """
    Find similar pro games to compare against.

    Args:
        game_id: The user's game ID
        limit: Number of similar games to return (default: 3)

    Returns:
        List of similar pro games with similarity scores
    """
    similar = find_similar_games(DB_PATH, game_id, limit)
    return {"similar_games": similar}


@app.get("/api/compare/{game_id1}/{game_id2}")
async def compare_games(game_id1: int, game_id2: int):
    """
    Get comparison data for two games.

    Args:
        game_id1: First game ID
        game_id2: Second game ID

    Returns:
        Comparison data including both games and their snapshots
    """
    conn = sqlite3.connect(DB_PATH)
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

    # Get snapshots for both games
    cursor.execute("""
        SELECT game_id, game_time_seconds, player_number, race,
               worker_count, mineral_collection_rate, gas_collection_rate,
               unspent_minerals, unspent_gas, army_value_minerals, army_value_gas,
               army_supply, base_count, collection_efficiency, spending_efficiency
        FROM snapshots
        WHERE game_id IN (?, ?)
        ORDER BY game_id, game_time_seconds, player_number
    """, (game_id1, game_id2))

    rows = cursor.fetchall()
    conn.close()

    snapshots = {game_id1: [], game_id2: []}
    for row in rows:
        game_id = row[0]
        snapshots[game_id].append({
            "game_time_seconds": row[1],
            "player_number": row[2],
            "race": row[3],
            "worker_count": row[4],
            "mineral_collection_rate": row[5],
            "gas_collection_rate": row[6],
            "unspent_minerals": row[7],
            "unspent_gas": row[8],
            "army_value_minerals": row[9],
            "army_value_gas": row[10],
            "army_supply": row[11],
            "base_count": row[12],
            "collection_efficiency": row[13],
            "spending_efficiency": row[14]
        })

    return {
        "game1": games[game_id1],
        "game2": games[game_id2],
        "snapshots1": snapshots[game_id1],
        "snapshots2": snapshots[game_id2]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

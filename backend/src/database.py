"""
Database schema and operations for SC2 replay snapshots.
"""
import sqlite3
from pathlib import Path
from typing import Dict, List, Any


def init_database(db_path: Path) -> None:
    """
    Initialize the database with games and snapshots tables.
    Safe to call multiple times - uses CREATE IF NOT EXISTS.

    Args:
        db_path: Path to the SQLite database file
    """
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create games table (safe to call multiple times)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            result INTEGER CHECK (result IN (1, 2)),

            -- Pro replay flag
            is_pro_replay BOOLEAN DEFAULT 0
        )
    """)

    # Create snapshots table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER REFERENCES games(id),
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
            unit_map_presence TEXT,  -- JSON

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
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER REFERENCES games(id),
            player_number INTEGER CHECK (player_number IN (1, 2)),
            event_type TEXT CHECK (event_type IN ('building', 'unit', 'upgrade')),
            item_name TEXT NOT NULL,
            game_time_seconds INTEGER NOT NULL,
            is_milestone BOOLEAN DEFAULT 0,

            UNIQUE(game_id, player_number, event_type, item_name)
        )
    """)

    # Create indexes (IF NOT EXISTS for idempotency)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_game_time
        ON snapshots(game_id, game_time_seconds)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_player
        ON snapshots(game_id, player_number)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_build_order_game
        ON build_order_events(game_id, player_number)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_build_order_milestones
        ON build_order_events(is_milestone)
    """)

    # Additional indexes for performance (from production audit)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_games_is_pro_replay
        ON games(is_pro_replay)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_games_matchup
        ON games(player1_race, player2_race)
    """)

    conn.commit()
    conn.close()


def delete_game_by_replay_file(conn: sqlite3.Connection, replay_file: str) -> bool:
    """
    Delete a game and all its related data (snapshots, build_order_events) by replay_file.

    Args:
        conn: Database connection
        replay_file: Name of the replay file

    Returns:
        True if a game was deleted, False if not found
    """
    cursor = conn.cursor()

    # Get the game_id first
    cursor.execute("SELECT id FROM games WHERE replay_file = ?", (replay_file,))
    result = cursor.fetchone()

    if result is None:
        return False

    game_id = result[0]

    # Delete in order: build_order_events, snapshots, then game
    cursor.execute("DELETE FROM build_order_events WHERE game_id = ?", (game_id,))
    cursor.execute("DELETE FROM snapshots WHERE game_id = ?", (game_id,))
    cursor.execute("DELETE FROM games WHERE id = ?", (game_id,))

    conn.commit()
    return True


def insert_game(conn: sqlite3.Connection, game_data: Dict[str, Any]) -> int:
    """
    Insert a game record into the database.

    Args:
        conn: Database connection
        game_data: Dictionary containing game metadata

    Returns:
        The game_id of the inserted record
    """
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO games (
            replay_file, game_date, game_length_seconds, map_name,
            game_version, build_number, expansion, game_type, game_speed, region,
            player1_name, player1_race, player2_name, player2_race, result,
            is_pro_replay
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

    conn.commit()
    return cursor.lastrowid


def insert_snapshots(conn: sqlite3.Connection, game_id: int, snapshots: List[Dict[str, Any]]) -> None:
    """
    Insert snapshot records into the database.

    Args:
        conn: Database connection
        game_id: The game_id to associate snapshots with
        snapshots: List of snapshot dictionaries
    """
    cursor = conn.cursor()

    for snapshot in snapshots:
        cursor.execute("""
            INSERT INTO snapshots (
                game_id, game_time_seconds, player_number, race,
                worker_count, mineral_collection_rate, gas_collection_rate,
                unspent_minerals, unspent_gas, total_minerals_collected, total_gas_collected,
                army_value_minerals, army_value_gas, army_supply, units,
                buildings, upgrades,
                base_count, vision_area, unit_map_presence,
                units_killed_value, units_lost_value,
                resources_spent_minerals, resources_spent_gas,
                collection_efficiency, spending_efficiency
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            game_id,
            snapshot['game_time_seconds'],
            snapshot['player_number'],
            snapshot['race'],
            snapshot['worker_count'],
            snapshot['mineral_collection_rate'],
            snapshot['gas_collection_rate'],
            snapshot['unspent_minerals'],
            snapshot['unspent_gas'],
            snapshot['total_minerals_collected'],
            snapshot['total_gas_collected'],
            snapshot['army_value_minerals'],
            snapshot['army_value_gas'],
            snapshot['army_supply'],
            snapshot['units'],
            snapshot['buildings'],
            snapshot['upgrades'],
            snapshot['base_count'],
            snapshot['vision_area'],
            snapshot['unit_map_presence'],
            snapshot['units_killed_value'],
            snapshot['units_lost_value'],
            snapshot['resources_spent_minerals'],
            snapshot['resources_spent_gas'],
            snapshot['collection_efficiency'],
            snapshot['spending_efficiency']
        ))

    conn.commit()


def insert_build_order_events(conn: sqlite3.Connection, game_id: int, player_number: int, events: List[Dict[str, Any]]) -> None:
    """
    Insert build order events into the database.

    Args:
        conn: Database connection
        game_id: The game_id to associate events with
        player_number: Player number (1 or 2)
        events: List of event dictionaries with keys: event_type, item_name, game_time_seconds, is_milestone
    """
    cursor = conn.cursor()

    for event in events:
        cursor.execute("""
            INSERT OR IGNORE INTO build_order_events (
                game_id, player_number, event_type, item_name, game_time_seconds, is_milestone
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, (
            game_id,
            player_number,
            event['event_type'],
            event['item_name'],
            event['game_time_seconds'],
            event.get('is_milestone', False)
        ))

    conn.commit()

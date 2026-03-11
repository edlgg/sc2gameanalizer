"""
Database schema and operations for SC2 replay snapshots.
"""
import os
from contextlib import contextmanager
from typing import Dict, List, Any

import psycopg2
import psycopg2.pool
import psycopg2.errors


_pool = None


def get_database_url():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    return url


def init_pool():
    global _pool
    _pool = psycopg2.pool.SimpleConnectionPool(1, 10, get_database_url())


def close_pool():
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None


@contextmanager
def get_connection():
    global _pool
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
    global _pool
    if _pool is None:
        init_pool()
    return _pool.getconn()


def return_connection(conn):
    global _pool
    if _pool is not None:
        _pool.putconn(conn)


def init_database() -> None:
    """
    Initialize the database with games and snapshots tables.
    Safe to call multiple times - uses CREATE IF NOT EXISTS.
    """
    with get_connection() as conn:
        cursor = conn.cursor()

        # Create games table (safe to call multiple times)
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

        # Composite index for the most common snapshot query pattern
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_snapshots_game_player_time
            ON snapshots(game_id, player_number, game_time_seconds)
        """)

        # Composite index for similarity batch queries
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_games_pro_matchup
            ON games(is_pro_replay, player1_race, player2_race)
        """)


def delete_game_by_replay_file(conn, replay_file: str, commit: bool = True) -> bool:
    """
    Delete a game and all its related data (snapshots, build_order_events, user_uploads) by replay_file.

    Args:
        conn: Database connection
        replay_file: Name of the replay file
        commit: If True, commit the transaction after delete

    Returns:
        True if a game was deleted, False if not found
    """
    cursor = conn.cursor()

    # Get the game_id first
    cursor.execute("SELECT id FROM games WHERE replay_file = %s", (replay_file,))
    result = cursor.fetchone()

    if result is None:
        return False

    game_id = result[0]

    # Delete in order: child tables first, then game
    # Belt-and-suspenders with CASCADE — explicit deletes ensure cleanup
    # even if FK enforcement is off on this connection
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
    """
    Insert a game record into the database.

    Args:
        conn: Database connection
        game_data: Dictionary containing game metadata
        commit: If True, commit the transaction after insert

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
    """
    Insert snapshot records into the database.

    Args:
        conn: Database connection
        game_id: The game_id to associate snapshots with
        snapshots: List of snapshot dictionaries
        commit: If True, commit the transaction after insert
    """
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
    """
    Insert build order events into the database.

    Args:
        conn: Database connection
        game_id: The game_id to associate events with
        player_number: Player number (1 or 2)
        events: List of event dictionaries with keys: event_type, item_name, game_time_seconds, is_milestone
        commit: If True, commit the transaction after insert
    """
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

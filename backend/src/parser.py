"""
Replay parsing orchestration.
"""
import psycopg2
from pathlib import Path
from typing import Dict, Any, List
import sc2reader

from backend.src.database import (
    get_connection_direct,
    return_connection,
    insert_game,
    insert_snapshots,
    insert_build_order_events,
)
from backend.src.snapshot import GameState
from backend.src.build_order import extract_build_order_events


# Patterns that indicate an AI/Computer player
_AI_PATTERNS = ['A.I.', 'ИИ', 'Cheater', 'Computer', 'Bot', 'IA ', 'I.A.', 'KI ']


def _validate_replay(replay) -> float:
    """
    Validate that a replay is suitable for analysis.

    Checks:
        - Must be a 1v1 game
        - Must be at least 120 seconds long
        - Must not be against AI/Computer

    Args:
        replay: Loaded sc2reader replay object

    Returns:
        Game length in seconds

    Raises:
        ValueError: If replay fails any validation check
    """
    if len(replay.players) != 2:
        raise ValueError(f"Not a 1v1 game (found {len(replay.players)} players)")

    game_length_seconds = replay.game_length.total_seconds()
    if game_length_seconds < 120:
        raise ValueError(f"Game too short for meaningful analysis ({game_length_seconds}s, minimum 120s)")

    for player in replay.players:
        for pattern in _AI_PATTERNS:
            if pattern in player.name:
                raise ValueError(f"Game against AI/Computer: {player.name}")

    return game_length_seconds


def reparse_replay_file(replay_path: Path) -> None:
    """
    Delete existing game data and reparse a replay file.
    The delete and re-insert are wrapped in a single transaction so that
    a failure during re-parse does not lose the original data.

    Args:
        replay_path: Path to the SC2Replay file

    Raises:
        ValueError: If replay is not valid (not 1v1, too short, etc.)
    """
    # Load and validate replay BEFORE touching the database
    replay = sc2reader.load_replay(str(replay_path), load_level=4)
    _validate_replay(replay)

    # Extract game metadata and generate snapshots
    game_data = extract_game_metadata(replay, replay_path)
    snapshots = generate_snapshots(replay)

    # Delete old data and insert new data in a single transaction
    conn = get_connection_direct()
    try:
        cursor = conn.cursor()

        # Delete existing game data if it exists
        cursor.execute("SELECT id FROM games WHERE replay_file = %s", (replay_path.name,))
        result = cursor.fetchone()
        if result:
            game_id = result[0]
            cursor.execute("DELETE FROM build_order_events WHERE game_id = %s", (game_id,))
            cursor.execute("DELETE FROM snapshots WHERE game_id = %s", (game_id,))
            try:
                cursor.execute("DELETE FROM user_uploads WHERE game_id = %s", (game_id,))
            except psycopg2.errors.UndefinedTable:
                conn.rollback()  # Clear the error state
            cursor.execute("DELETE FROM games WHERE id = %s", (game_id,))
            print(f"Deleted existing game data for {replay_path.name}")

        # Insert new data (no intermediate commits)
        game_id = insert_game(conn, game_data, commit=False)
        insert_snapshots(conn, game_id, snapshots, commit=False)

        # Extract and insert build order events for both players
        for player_num in [1, 2]:
            player_snapshots = [s for s in snapshots if s['player_number'] == player_num]
            if player_snapshots:
                race = player_snapshots[0]['race']
                events = extract_build_order_events(player_snapshots, race)
                if events:
                    insert_build_order_events(conn, game_id, player_num, events, commit=False)

        # Commit entire transaction at once
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        return_connection(conn)


def parse_replay_file(replay_path: Path) -> None:
    """
    Parse a replay file and store snapshots in the database.
    All inserts are wrapped in a single transaction — on failure,
    everything is rolled back so no partial data is left behind.

    Args:
        replay_path: Path to the SC2Replay file

    Raises:
        ValueError: If replay is not valid (not 1v1, too short, etc.)
    """
    # Load replay
    replay = sc2reader.load_replay(str(replay_path), load_level=4)
    _validate_replay(replay)

    # Extract game metadata
    game_data = extract_game_metadata(replay, replay_path)

    # Generate snapshots every 5 seconds for both players
    snapshots = generate_snapshots(replay)

    # Write to database in a single transaction
    conn = get_connection_direct()
    try:
        game_id = insert_game(conn, game_data, commit=False)
        insert_snapshots(conn, game_id, snapshots, commit=False)

        # Extract and insert build order events for both players
        for player_num in [1, 2]:
            # Filter snapshots for this player
            player_snapshots = [s for s in snapshots if s['player_number'] == player_num]

            if player_snapshots:
                # Get race from first snapshot
                race = player_snapshots[0]['race']

                # Extract build order events
                events = extract_build_order_events(player_snapshots, race)

                # Insert into database
                if events:
                    insert_build_order_events(conn, game_id, player_num, events, commit=False)

        # Commit entire transaction at once
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        return_connection(conn)


def extract_game_metadata(replay, replay_path: Path) -> Dict[str, Any]:
    """
    Extract game metadata from replay.

    Args:
        replay: Loaded sc2reader replay object
        replay_path: Path to the replay file

    Returns:
        Dictionary containing game metadata
    """
    players = list(replay.players)

    # Determine winner (result: 1 or 2)
    result = None
    for idx, player in enumerate(players, 1):
        if hasattr(player, 'result') and player.result == 'Win':
            result = idx
            break

    # If no winner found, check if someone lost (the OTHER player wins)
    if result is None:
        for idx, player in enumerate(players, 1):
            if hasattr(player, 'result') and player.result == 'Loss':
                # The other player won
                result = 2 if idx == 1 else 1
                break

    # If still unclear, leave as None rather than biasing toward player 1
    # The DB schema allows NULL for result

    # Determine if this is a pro replay
    # Pro replays are downloaded from spawningtool.com and have names like "replay_12345.SC2Replay"
    is_pro_replay = replay_path.name.startswith('replay_')

    return {
        'replay_file': replay_path.name,
        'game_date': replay.date if hasattr(replay, 'date') else None,
        'game_length_seconds': int(replay.game_length.total_seconds()),
        'map_name': replay.map_name if hasattr(replay, 'map_name') else None,
        'game_version': replay.release_string if hasattr(replay, 'release_string') else None,
        'build_number': replay.build if hasattr(replay, 'build') else None,
        'expansion': replay.expansion if hasattr(replay, 'expansion') else None,
        'game_type': replay.game_type if hasattr(replay, 'game_type') else None,
        'game_speed': replay.speed if hasattr(replay, 'speed') else None,
        'region': replay.region if hasattr(replay, 'region') else None,
        'player1_name': players[0].name,
        'player1_race': players[0].play_race,
        'player2_name': players[1].name,
        'player2_race': players[1].play_race,
        'result': result,
        'is_pro_replay': is_pro_replay
    }


def generate_snapshots(replay) -> List[Dict[str, Any]]:
    """
    Generate snapshots every 5 seconds for both players.

    Args:
        replay: Loaded sc2reader replay object

    Returns:
        List of snapshot dictionaries
    """
    players = list(replay.players)

    # Initialize game states for both players
    game_states = {
        player: GameState(player, idx)
        for idx, player in enumerate(players, 1)
    }

    # Generate snapshots every 5 seconds
    snapshots = []
    game_length_seconds = int(replay.game_length.total_seconds())

    snapshot_times = list(range(5, game_length_seconds + 1, 5))
    snapshot_idx = 0

    for event in replay.events:
        # Convert event time to seconds
        event_time_seconds = event.second

        # Capture snapshots for all times that have passed
        while snapshot_idx < len(snapshot_times) and event_time_seconds >= snapshot_times[snapshot_idx]:
            # Capture snapshot for both players at this time
            for player, state in game_states.items():
                snapshot = state.get_snapshot(snapshot_times[snapshot_idx])
                snapshots.append(snapshot)

            snapshot_idx += 1

        # Process the event
        for player, state in game_states.items():
            state.process_event(event)

    # Capture any remaining snapshots after all events
    while snapshot_idx < len(snapshot_times):
        for player, state in game_states.items():
            snapshot = state.get_snapshot(snapshot_times[snapshot_idx])
            snapshots.append(snapshot)
        snapshot_idx += 1

    return snapshots

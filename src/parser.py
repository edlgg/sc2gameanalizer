"""
Replay parsing orchestration.
"""
import sqlite3
from pathlib import Path
from typing import Dict, Any, List
import sc2reader

from src.database import insert_game, insert_snapshots
from src.snapshot import GameState


def parse_replay_file(replay_path: Path, db_path: Path) -> None:
    """
    Parse a replay file and store snapshots in the database.

    Args:
        replay_path: Path to the SC2Replay file
        db_path: Path to the SQLite database

    Raises:
        ValueError: If replay is not valid (not 1v1, too short, etc.)
    """
    # Load replay
    replay = sc2reader.load_replay(str(replay_path), load_level=4)

    # Validate: must be 1v1
    if len(replay.players) != 2:
        raise ValueError(f"Not a 1v1 game (found {len(replay.players)} players)")

    # Validate: must be at least 60 seconds
    game_length_seconds = replay.game_length.total_seconds()
    if game_length_seconds < 60:
        raise ValueError(f"Game too short ({game_length_seconds}s < 60s)")

    # Extract game metadata
    game_data = extract_game_metadata(replay, replay_path)

    # Generate snapshots every 5 seconds for both players
    snapshots = generate_snapshots(replay)

    # Write to database
    conn = sqlite3.connect(db_path)
    try:
        game_id = insert_game(conn, game_data)
        insert_snapshots(conn, game_id, snapshots)
    finally:
        conn.close()


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

    # If no winner found, check if someone left/lost
    if result is None:
        for idx, player in enumerate(players, 1):
            if hasattr(player, 'result') and player.result != 'Loss':
                result = idx
                break

    # Fallback to player 1 if still unclear
    if result is None:
        result = 1

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
        'result': result
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

    # Process all events chronologically
    for event in replay.events:
        for player, state in game_states.items():
            state.process_event(event)

    # Generate snapshots every 5 seconds
    snapshots = []
    game_length_seconds = int(replay.game_length.total_seconds())

    # We need to re-process events and capture state at each 5-second mark
    # Reset states
    game_states = {
        player: GameState(player, idx)
        for idx, player in enumerate(players, 1)
    }

    snapshot_times = list(range(0, game_length_seconds + 1, 5))
    snapshot_idx = 0
    current_snapshot_time = snapshot_times[snapshot_idx] if snapshot_times else 0

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

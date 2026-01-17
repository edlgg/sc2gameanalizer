"""Replay parser - extracts metadata from .SC2Replay files."""

import sc2reader
from typing import Optional, Dict, Any
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def parse_replay_metadata(file_path: str) -> Optional[Dict[str, Any]]:
    """
    Parse basic metadata from a replay file.

    Args:
        file_path: Path to .SC2Replay file

    Returns:
        Dictionary with game metadata, or None if parsing fails
    """
    try:
        # Load replay with sc2reader
        replay = sc2reader.load_replay(file_path, load_level=4)

        # Validate it's a 1v1 game
        if not replay or len(replay.players) != 2:
            logger.warning(f"Skipping {file_path}: Not a 1v1 game (found {len(replay.players) if replay else 0} players)")
            return None

        # Extract players
        player1 = replay.players[0]
        player2 = replay.players[1]

        # Determine winner (1 or 2)
        winner = None
        if hasattr(player1, 'result'):
            if player1.result == 'Win':
                winner = 1
            elif player2.result == 'Win':
                winner = 2

        # Extract metadata
        metadata = {
            'replay_file_path': file_path,
            'map_name': replay.map_name if hasattr(replay, 'map_name') else None,
            'game_length_seconds': int(replay.game_length.total_seconds()) if hasattr(replay, 'game_length') else 0,
            'game_date': replay.date if hasattr(replay, 'date') else None,
            'player1_name': player1.name,
            'player1_race': player1.play_race,
            'player2_name': player2.name,
            'player2_race': player2.play_race,
            'winner': winner,
            'replay_object': replay  # Keep for snapshot generation
        }

        logger.info(f"Parsed {Path(file_path).name}: {player1.name} ({player1.play_race}) vs {player2.name} ({player2.play_race})")
        return metadata

    except Exception as e:
        logger.error(f"Failed to parse {file_path}: {str(e)}")
        return None

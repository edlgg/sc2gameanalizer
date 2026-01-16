import sc2reader
from typing import Optional, Dict, Any

class ReplayParser:
    """Parse SC2 replay files using sc2reader library."""

    def load_replay(self, filepath: str):
        """
        Load a replay file.

        Args:
            filepath: Path to .SC2Replay file

        Returns:
            sc2reader.Replay object

        Raises:
            FileNotFoundError: If replay file doesn't exist
            Exception: If replay parsing fails
        """
        try:
            replay = sc2reader.load_replay(filepath, load_level=4)
            return replay
        except FileNotFoundError:
            raise FileNotFoundError(f"Replay file not found: {filepath}")
        except Exception as e:
            raise Exception(f"Failed to parse replay: {e}")

    def extract_game_metadata(self, replay) -> Dict[str, Any]:
        """
        Extract basic game metadata from replay.

        Args:
            replay: sc2reader.Replay object

        Returns:
            Dictionary with game metadata
        """
        # Get human players (exclude observers)
        players = [p for p in replay.players if p.is_human]

        if len(players) < 2:
            raise ValueError("Replay must have at least 2 human players")

        # Assume first player is the POV player
        player = players[0]
        opponent = players[1]

        # Determine matchup (e.g., PvT, ZvZ)
        matchup = f"{player.play_race[0]}v{opponent.play_race[0]}"

        # Get result
        result = "Win" if player.result == "Win" else "Loss" if player.result == "Loss" else None

        return {
            "player_name": player.name,
            "player_race": player.play_race,
            "opponent_name": opponent.name,
            "opponent_race": opponent.play_race,
            "matchup": matchup,
            "game_length": replay.game_length.seconds,
            "map_name": replay.map_name,
            "game_date": replay.date.strftime("%Y-%m-%d") if replay.date else None,
            "result": result
        }

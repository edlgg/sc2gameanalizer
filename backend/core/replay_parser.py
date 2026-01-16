import sc2reader
from typing import Optional, Dict, Any, List

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

    def extract_build_events(self, replay, player_index: int = 0) -> List[Dict[str, Any]]:
        """
        Extract build events (buildings, units, upgrades) from replay.

        Args:
            replay: sc2reader.Replay object
            player_index: Index of player to extract events for (0 = first player)

        Returns:
            List of event dictionaries
        """
        players = [p for p in replay.players if p.is_human]
        if player_index >= len(players):
            raise ValueError(f"Player index {player_index} out of range")

        player = players[player_index]
        events = []

        # Track cumulative resources spent
        cumulative_resources = 0

        for event in replay.events:
            event_data = None

            # Unit born/trained events
            if event.name == "UnitBornEvent":
                if hasattr(event, 'unit') and event.unit and event.unit.owner == player:
                    unit_name = event.unit.name

                    # Calculate resource cost (simplified)
                    cost = self._get_unit_cost(unit_name)
                    cumulative_resources += cost

                    event_data = {
                        "game_time": event.second,
                        "event_type": self._classify_unit_type(unit_name),
                        "name": unit_name,
                        "count": 1,
                        "supply_used": None,
                        "resources_spent": cumulative_resources,
                        "location_x": event.x if hasattr(event, 'x') else None,
                        "location_y": event.y if hasattr(event, 'y') else None
                    }

            # Upgrade events
            elif event.name == "UpgradeCompleteEvent":
                if hasattr(event, 'player') and event.player == player:
                    upgrade_name = event.upgrade_type_name if hasattr(event, 'upgrade_type_name') else "Unknown"
                    cost = self._get_upgrade_cost(upgrade_name)
                    cumulative_resources += cost

                    event_data = {
                        "game_time": event.second,
                        "event_type": "upgrade",
                        "name": upgrade_name,
                        "count": 1,
                        "supply_used": None,
                        "resources_spent": cumulative_resources,
                        "location_x": None,
                        "location_y": None
                    }

            if event_data:
                events.append(event_data)

        return events

    def _classify_unit_type(self, unit_name: str) -> str:
        """Classify unit as building, unit, or worker."""
        workers = ["Probe", "SCV", "Drone"]
        buildings = ["Nexus", "Gateway", "CyberneticsCore", "Forge", "PhotonCannon",
                    "CommandCenter", "Barracks", "Factory", "Starport", "EngineeringBay",
                    "Hatchery", "SpawningPool", "RoachWarren", "HydraliskDen", "Lair"]

        if unit_name in workers:
            return "unit"
        elif any(building in unit_name for building in buildings):
            return "building"
        else:
            return "unit"

    def _get_unit_cost(self, unit_name: str) -> int:
        """Get resource cost of unit (minerals + gas*1.5). Simplified."""
        costs = {
            "Probe": 50, "SCV": 50, "Drone": 50,
            "Zealot": 100, "Stalker": 200, "Sentry": 125,
            "Marine": 50, "Marauder": 125, "Tank": 225,
            "Zergling": 25, "Roach": 100, "Hydralisk": 150,
            "Gateway": 150, "CyberneticsCore": 150,
            "Nexus": 400, "CommandCenter": 400, "Hatchery": 300
        }
        return costs.get(unit_name, 100)

    def _get_upgrade_cost(self, upgrade_name: str) -> int:
        """Get resource cost of upgrade. Simplified."""
        return 150

    def extract_snapshots(self, replay, player_index: int = 0, interval: int = 5) -> List[Dict[str, Any]]:
        """
        Extract game state snapshots at regular intervals.

        NOTE: Current implementation uses simplified estimations for snapshot values.
        Production version should track actual unit counts, resources, and army values
        by processing all game events sequentially and maintaining accurate state.

        Args:
            replay: sc2reader.Replay object
            player_index: Index of player to extract snapshots for
            interval: Seconds between snapshots (default 5)

        Returns:
            List of snapshot dictionaries
        """
        players = [p for p in replay.players if p.is_human]
        if player_index >= len(players):
            raise ValueError(f"Player index {player_index} out of range")

        player = players[player_index]
        game_length = replay.game_length.seconds

        # Initialize snapshot storage
        snapshots = []
        snapshot_times = range(0, game_length + 1, interval)

        # Create initial snapshots with zero values
        for t in snapshot_times:
            snapshots.append({
                "game_time": t,
                "worker_count": 0,
                "army_value": 0,
                "army_supply": 0,
                "mineral_collection_rate": 0,
                "gas_collection_rate": 0,
                "unspent_resources": 0,
                "bases_count": 0,
                "upgrade_progress": 0
            })

        # For simplicity, estimate values at each snapshot time
        # In production, you'd track state changes more precisely
        for i, snapshot_time in enumerate(snapshot_times):
            # Estimate worker count (simplified - grows linearly early game)
            workers = min(12 + (snapshot_time // 30), 80)  # Rough estimate

            # Estimate army value (simplified)
            army_val = max(0, (snapshot_time - 180) * 10)  # Grows after 3min

            # Estimate bases (simplified)
            bases = 1 + (snapshot_time // 180)  # New base every 3 minutes

            snapshots[i].update({
                "worker_count": workers,
                "army_value": army_val,
                "army_supply": army_val // 50,  # Rough estimate
                "mineral_collection_rate": workers * 40,  # Simplified
                "gas_collection_rate": min(workers // 2, 6) * 100,  # 6 per gas
                "unspent_resources": 200,  # Would need real bank tracking
                "bases_count": min(bases, 4),
                "upgrade_progress": 0  # Would need real upgrade tracking
            })

        return snapshots

"""
Database writer utility for saving parsed replay data to database.
"""
from sqlalchemy.orm import Session
from models import Game, BuildEvent, Snapshot, ProGame
from typing import List, Dict, Any


class DatabaseWriter:
    """Write parsed replay data to database."""

    def __init__(self, session: Session):
        self.session = session

    def write_game(
        self,
        metadata: Dict[str, Any],
        events: List[Dict[str, Any]],
        snapshots: List[Dict[str, Any]],
        is_pro: bool = False,
        build_signature: str = None,
        build_label: str = None
    ) -> int:
        """
        Write a complete game to database.

        Args:
            metadata: Game metadata dictionary
            events: List of build event dictionaries
            snapshots: List of snapshot dictionaries
            is_pro: Whether this is a pro game
            build_signature: Build order signature (for pro games)
            build_label: Optional build label (e.g., "Proxy Reaper")

        Returns:
            game_id of created game
        """
        # Create game record
        game = Game(
            player_name=metadata["player_name"],
            player_race=metadata["player_race"],
            opponent_name=metadata["opponent_name"],
            opponent_race=metadata["opponent_race"],
            matchup=metadata["matchup"],
            game_length=metadata["game_length"],
            map_name=metadata.get("map_name"),
            game_date=metadata.get("game_date"),
            result=metadata.get("result"),
            is_pro_game=is_pro
        )
        self.session.add(game)
        self.session.flush()  # Get game.id

        # Write build events
        for event in events:
            build_event = BuildEvent(
                game_id=game.id,
                game_time=event["game_time"],
                event_type=event["event_type"],
                name=event["name"],
                count=event.get("count", 1),
                supply_used=event.get("supply_used"),
                resources_spent=event.get("resources_spent"),
                location_x=event.get("location_x"),
                location_y=event.get("location_y")
            )
            self.session.add(build_event)

        # Write snapshots
        for snap in snapshots:
            snapshot = Snapshot(
                game_id=game.id,
                game_time=snap["game_time"],
                worker_count=snap["worker_count"],
                army_value=snap["army_value"],
                army_supply=snap["army_supply"],
                mineral_collection_rate=snap.get("mineral_collection_rate", 0),
                gas_collection_rate=snap.get("gas_collection_rate", 0),
                unspent_resources=snap.get("unspent_resources", 0),
                bases_count=snap["bases_count"],
                upgrade_progress=snap.get("upgrade_progress", 0)
            )
            self.session.add(snapshot)

        # If pro game, write pro metadata
        if is_pro and build_signature:
            # Calculate aggregate stats
            snap_at_6min = next((s for s in snapshots if s["game_time"] == 360), None)
            snap_at_8min = next((s for s in snapshots if s["game_time"] == 480), None)

            pro_meta = ProGame(
                game_id=game.id,
                player_name=metadata["player_name"],
                opponent_name=metadata["opponent_name"],
                matchup=metadata["matchup"],
                build_signature=build_signature,
                build_label=build_label,
                avg_worker_at_6min=snap_at_6min["worker_count"] if snap_at_6min else None,
                avg_army_value_at_8min=snap_at_8min["army_value"] if snap_at_8min else None
            )
            self.session.add(pro_meta)

        self.session.commit()
        return game.id

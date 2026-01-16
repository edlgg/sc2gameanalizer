import json
from typing import List, Dict, Any

class BuildSignatureGenerator:
    """Generate build signatures for replay matching."""

    # Key buildings/units to track per race
    KEY_PROTOSS = [
        "Gateway", "CyberneticsCore", "Nexus", "Forge", "RoboticsFacility",
        "Stargate", "TwilightCouncil", "TemplarArchives", "DarkShrine",
        "Stalker", "Zealot", "Immortal", "Colossus", "Phoenix", "Oracle"
    ]

    KEY_TERRAN = [
        "Barracks", "Factory", "Starport", "CommandCenter", "EngineeringBay",
        "Marine", "Marauder", "Tank", "Medivac", "Liberator", "Battlecruiser"
    ]

    KEY_ZERG = [
        "Hatchery", "SpawningPool", "RoachWarren", "HydraliskDen", "Lair",
        "Spire", "InfestationPit", "Zergling", "Roach", "Hydralisk", "Mutalisk"
    ]

    def __init__(self):
        self.key_units = set(self.KEY_PROTOSS + self.KEY_TERRAN + self.KEY_ZERG)

    def generate_signature(self, events: List[Dict[str, Any]], max_time: int = 480) -> str:
        """
        Generate build signature from events list.

        Args:
            events: List of build event dictionaries
            max_time: Maximum game time to include (default 480s = 8min)

        Returns:
            JSON string of signature: {"Gateway": [120, 145], ...}
        """
        signature = {}

        for event in events:
            # Only include events within time window
            if event["game_time"] > max_time:
                continue

            # Only track key units/buildings
            name = event["name"]
            if name not in self.key_units:
                continue

            # Add timestamp to signature
            if name not in signature:
                signature[name] = []

            signature[name].append(event["game_time"])

        return json.dumps(signature)

    def parse_signature(self, signature_json: str) -> Dict[str, List[int]]:
        """Parse signature JSON string to dictionary."""
        return json.loads(signature_json)

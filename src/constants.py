"""Constants for SC2 replay parsing - unit costs, race mappings, etc."""

# Worker units across all races
WORKER_UNITS = ["Probe", "SCV", "Drone"]

# Base buildings across all races
BASE_BUILDINGS = [
    "Nexus",
    "CommandCenter", "OrbitalCommand", "PlanetaryFortress",
    "Hatchery", "Lair", "Hive"
]

# Unit costs (mineral + gas cost)
# Format: "UnitName": (minerals, gas)
UNIT_COSTS = {
    # Terran Units
    "SCV": (50, 0),
    "Marine": (50, 0),
    "Marauder": (100, 25),
    "Reaper": (50, 50),
    "Ghost": (150, 125),
    "Hellion": (100, 0),
    "Hellbat": (100, 0),
    "WidowMine": (75, 25),
    "Cyclone": (150, 100),
    "SiegeTank": (150, 125),
    "Thor": (300, 200),
    "Viking": (150, 75),
    "Medivac": (100, 100),
    "Liberator": (150, 150),
    "Raven": (100, 200),
    "Banshee": (150, 100),
    "Battlecruiser": (400, 300),

    # Protoss Units
    "Probe": (50, 0),
    "Zealot": (100, 0),
    "Stalker": (125, 50),
    "Sentry": (50, 100),
    "Adept": (100, 25),
    "HighTemplar": (50, 150),
    "DarkTemplar": (125, 125),
    "Immortal": (275, 100),
    "Colossus": (300, 200),
    "Disruptor": (150, 150),
    "Archon": (0, 0),  # Merged from templars
    "Observer": (25, 75),
    "WarpPrism": (200, 0),
    "Phoenix": (150, 100),
    "VoidRay": (250, 150),
    "Oracle": (150, 150),
    "Tempest": (300, 200),
    "Carrier": (350, 250),
    "Mothership": (400, 400),

    # Zerg Units
    "Drone": (50, 0),
    "Queen": (150, 0),
    "Zergling": (25, 0),
    "Baneling": (25, 25),
    "Roach": (75, 25),
    "Ravager": (100, 100),
    "Hydralisk": (100, 50),
    "Lurker": (200, 100),
    "Infestor": (100, 150),
    "SwarmHost": (100, 75),
    "Ultralisk": (300, 200),
    "Overlord": (100, 0),
    "Overseer": (50, 50),
    "Mutalisk": (100, 100),
    "Corruptor": (150, 100),
    "BroodLord": (300, 250),
    "Viper": (100, 200),
}

def get_unit_cost(unit_name: str) -> int:
    """Get total cost (minerals + gas) for a unit."""
    if unit_name in UNIT_COSTS:
        minerals, gas = UNIT_COSTS[unit_name]
        return minerals + gas
    return 0

def is_worker(unit_name: str) -> bool:
    """Check if a unit is a worker."""
    return unit_name in WORKER_UNITS

def is_base_building(building_name: str) -> bool:
    """Check if a building is a base (Nexus/CC/Hatchery)."""
    return building_name in BASE_BUILDINGS

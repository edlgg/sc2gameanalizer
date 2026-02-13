"""
Constants for SC2 unit costs, races, and game definitions.
"""

# Unit costs: minerals, gas, supply
UNIT_COSTS = {
    # Terran Units
    'Marine': {'minerals': 50, 'gas': 0, 'supply': 1},
    'Marauder': {'minerals': 100, 'gas': 25, 'supply': 2},
    'Reaper': {'minerals': 50, 'gas': 50, 'supply': 1},
    'Ghost': {'minerals': 150, 'gas': 125, 'supply': 2},
    'Hellion': {'minerals': 100, 'gas': 0, 'supply': 2},
    'Hellbat': {'minerals': 100, 'gas': 0, 'supply': 2},
    'WidowMine': {'minerals': 75, 'gas': 25, 'supply': 2},
    'Cyclone': {'minerals': 150, 'gas': 100, 'supply': 3},
    'SiegeTank': {'minerals': 150, 'gas': 125, 'supply': 3},
    'Thor': {'minerals': 300, 'gas': 200, 'supply': 6},
    'Viking': {'minerals': 150, 'gas': 75, 'supply': 2},
    'Medivac': {'minerals': 100, 'gas': 100, 'supply': 2},
    'Liberator': {'minerals': 150, 'gas': 150, 'supply': 3},
    'Raven': {'minerals': 100, 'gas': 200, 'supply': 2},
    'Banshee': {'minerals': 150, 'gas': 100, 'supply': 3},
    'Battlecruiser': {'minerals': 400, 'gas': 300, 'supply': 6},
    'SCV': {'minerals': 50, 'gas': 0, 'supply': 1},

    # Protoss Units
    'Probe': {'minerals': 50, 'gas': 0, 'supply': 1},
    'Zealot': {'minerals': 100, 'gas': 0, 'supply': 2},
    'Stalker': {'minerals': 125, 'gas': 50, 'supply': 2},
    'Sentry': {'minerals': 50, 'gas': 100, 'supply': 2},
    'Adept': {'minerals': 100, 'gas': 25, 'supply': 2},
    'HighTemplar': {'minerals': 50, 'gas': 150, 'supply': 2},
    'DarkTemplar': {'minerals': 125, 'gas': 125, 'supply': 2},
    'Archon': {'minerals': 100, 'gas': 300, 'supply': 4},  # Combined cost of 2 High Templars (2x 50m/150g)
    'Observer': {'minerals': 25, 'gas': 75, 'supply': 1},
    'WarpPrism': {'minerals': 200, 'gas': 0, 'supply': 2},
    'Immortal': {'minerals': 275, 'gas': 100, 'supply': 4},
    'Colossus': {'minerals': 300, 'gas': 200, 'supply': 6},
    'Disruptor': {'minerals': 150, 'gas': 150, 'supply': 3},
    'Phoenix': {'minerals': 150, 'gas': 100, 'supply': 2},
    'VoidRay': {'minerals': 250, 'gas': 150, 'supply': 4},
    'Oracle': {'minerals': 150, 'gas': 150, 'supply': 3},
    'Tempest': {'minerals': 250, 'gas': 175, 'supply': 4},
    'Carrier': {'minerals': 350, 'gas': 250, 'supply': 6},
    'Mothership': {'minerals': 400, 'gas': 400, 'supply': 8},

    # Zerg Units
    'Drone': {'minerals': 50, 'gas': 0, 'supply': 1},
    'Overlord': {'minerals': 100, 'gas': 0, 'supply': 0},
    'Overseer': {'minerals': 150, 'gas': 50, 'supply': 0},  # Overlord + morph cost
    'Zergling': {'minerals': 25, 'gas': 0, 'supply': 0.5},  # 50 minerals for 2 zerglings
    'Baneling': {'minerals': 50, 'gas': 25, 'supply': 0.5},  # Zergling + morph cost
    'Roach': {'minerals': 75, 'gas': 25, 'supply': 2},
    'Ravager': {'minerals': 100, 'gas': 100, 'supply': 3},
    'Hydralisk': {'minerals': 100, 'gas': 50, 'supply': 2},
    'Lurker': {'minerals': 200, 'gas': 150, 'supply': 3},
    'Infestor': {'minerals': 100, 'gas': 150, 'supply': 2},
    'SwarmHost': {'minerals': 100, 'gas': 75, 'supply': 3},
    'Ultralisk': {'minerals': 300, 'gas': 200, 'supply': 6},
    'Queen': {'minerals': 150, 'gas': 0, 'supply': 2},
    'Mutalisk': {'minerals': 100, 'gas': 100, 'supply': 2},
    'Corruptor': {'minerals': 150, 'gas': 100, 'supply': 2},
    'BroodLord': {'minerals': 300, 'gas': 250, 'supply': 4},  # Corruptor + morph cost
    'Viper': {'minerals': 100, 'gas': 200, 'supply': 3},
}

# Morph relationships: target → (source, count consumed)
# Used to fix double-counting when source unit transforms into target
MORPH_SOURCES = {
    'Baneling': ('Zergling', 1),
    'Ravager': ('Roach', 1),
    'Lurker': ('Hydralisk', 1),
    'BroodLord': ('Corruptor', 1),
    'Overseer': ('Overlord', 1),
    'Archon': ('HighTemplar', 2),  # Merges 2 Templar (HT or DT)
}

# Worker units for each race
WORKER_UNITS = {'SCV', 'Probe', 'Drone'}

# Base buildings (town halls)
BASE_BUILDINGS = {
    # Terran
    'CommandCenter', 'OrbitalCommand', 'PlanetaryFortress',
    # Protoss
    'Nexus',
    # Zerg
    'Hatchery', 'Lair', 'Hive'
}

# Building costs (for buildings we might want to track)
BUILDING_COSTS = {
    # Terran
    'CommandCenter': {'minerals': 400, 'gas': 0},
    'OrbitalCommand': {'minerals': 550, 'gas': 0},  # CC + upgrade
    'PlanetaryFortress': {'minerals': 550, 'gas': 150},
    'SupplyDepot': {'minerals': 100, 'gas': 0},
    'Refinery': {'minerals': 75, 'gas': 0},
    'Barracks': {'minerals': 150, 'gas': 0},
    'Factory': {'minerals': 150, 'gas': 100},
    'Starport': {'minerals': 150, 'gas': 100},
    'EngineeringBay': {'minerals': 125, 'gas': 0},
    'Armory': {'minerals': 150, 'gas': 100},
    'Bunker': {'minerals': 100, 'gas': 0},
    'MissileTurret': {'minerals': 100, 'gas': 0},

    # Protoss
    'Nexus': {'minerals': 400, 'gas': 0},
    'Pylon': {'minerals': 100, 'gas': 0},
    'Assimilator': {'minerals': 75, 'gas': 0},
    'Gateway': {'minerals': 150, 'gas': 0},
    'WarpGate': {'minerals': 150, 'gas': 0},
    'CyberneticsCore': {'minerals': 150, 'gas': 0},
    'Forge': {'minerals': 150, 'gas': 0},
    'RoboticsFacility': {'minerals': 200, 'gas': 100},
    'Stargate': {'minerals': 150, 'gas': 150},
    'TwilightCouncil': {'minerals': 150, 'gas': 100},
    'TemplarArchive': {'minerals': 150, 'gas': 200},
    'DarkShrine': {'minerals': 150, 'gas': 150},
    'RoboticsBay': {'minerals': 200, 'gas': 200},
    'FleetBeacon': {'minerals': 300, 'gas': 200},
    'PhotonCannon': {'minerals': 150, 'gas': 0},

    # Zerg
    'Hatchery': {'minerals': 300, 'gas': 0},
    'Lair': {'minerals': 450, 'gas': 100},  # Hatchery + upgrade
    'Hive': {'minerals': 650, 'gas': 250},  # Lair + upgrade
    'Extractor': {'minerals': 25, 'gas': 0},
    'SpawningPool': {'minerals': 200, 'gas': 0},
    'RoachWarren': {'minerals': 150, 'gas': 0},
    'BanelingNest': {'minerals': 100, 'gas': 50},
    'EvolutionChamber': {'minerals': 75, 'gas': 0},
    'HydraliskDen': {'minerals': 100, 'gas': 100},
    'LurkerDen': {'minerals': 150, 'gas': 150},
    'Spire': {'minerals': 200, 'gas': 200},
    'GreaterSpire': {'minerals': 300, 'gas': 350},  # Spire + upgrade
    'InfestationPit': {'minerals': 100, 'gas': 100},
    'UltraliskCavern': {'minerals': 150, 'gas': 200},
    'SpineCrawler': {'minerals': 100, 'gas': 0},
    'SporeCrawler': {'minerals': 75, 'gas': 0},
}

# Sight ranges for vision calculation (approximate)
SIGHT_RANGES = {
    'Marine': 11,
    'Stalker': 10,
    'Zergling': 8,
    'Observer': 11,
    'Overlord': 11,
    # Add more as needed
}

# Default sight range for units not specified
DEFAULT_SIGHT_RANGE = 9

"""
Build order extraction logic for detecting first appearance of buildings, units, and upgrades.

Focuses on race-specific macro milestones that are critical for build order analysis.
"""
import json
from typing import List, Dict, Any, Set


# Race-specific macro milestones
MACRO_MILESTONES = {
    'Terran': {
        'buildings': [
            'Barracks', 'Factory', 'Starport', 'CommandCenter',
            'EngineeringBay', 'Armory', 'FusionCore', 'GhostAcademy'
        ],
        'units': [
            'Marine', 'Reaper', 'Marauder', 'Hellion', 'SiegeTank',
            'Medivac', 'Viking', 'Banshee', 'Raven', 'Battlecruiser', 'Thor'
        ],
        'upgrades': [
            'Stimpack', 'CombatShield', 'ConcussiveShells',
            'InfantryWeapons1', 'InfantryWeapons2', 'InfantryWeapons3',
            'InfantryArmor1', 'InfantryArmor2', 'InfantryArmor3',
            'VehicleWeapons1', 'VehicleWeapons2', 'VehicleWeapons3',
            'Cloak', '+1Attack', '+1Armor'
        ]
    },
    'Protoss': {
        'buildings': [
            'Gateway', 'CyberneticsCore', 'Nexus', 'Forge',
            'RoboticsFacility', 'Stargate', 'TwilightCouncil',
            'TemplarArchives', 'DarkShrine', 'RoboticsBay', 'FleetBeacon'
        ],
        'units': [
            'Zealot', 'Stalker', 'Sentry', 'Adept', 'HighTemplar', 'DarkTemplar',
            'Immortal', 'Colossus', 'Disruptor', 'WarpPrism',
            'Phoenix', 'VoidRay', 'Oracle', 'Tempest', 'Carrier', 'Mothership'
        ],
        'upgrades': [
            'WarpGateResearch', 'Charge', 'Blink', 'ResonatingGlaives',
            'GroundWeapons1', 'GroundWeapons2', 'GroundWeapons3',
            'GroundArmor1', 'GroundArmor2', 'GroundArmor3',
            'AirWeapons1', 'AirWeapons2', 'AirWeapons3',
            'Shields1', 'Shields2', 'Shields3',
            'PsiStorm', '+1Attack', '+1Armor'
        ]
    },
    'Zerg': {
        'buildings': [
            'SpawningPool', 'Hatchery', 'RoachWarren', 'BanelingNest',
            'Lair', 'Spire', 'HydraliskDen', 'LurkerDen',
            'InfestationPit', 'UltraliskCavern', 'Hive', 'NydusNetwork'
        ],
        'units': [
            'Zergling', 'Queen', 'Roach', 'Ravager', 'Baneling',
            'Hydralisk', 'Lurker', 'Mutalisk', 'Corruptor', 'SwarmHost',
            'Infestor', 'Ultralisk', 'BroodLord', 'Viper'
        ],
        'upgrades': [
            'MetabolicBoost', 'AdrenalGlands', 'Burrow',
            'GlialReconstitution', 'TunnelingClaws',
            'MeleeAttacks1', 'MeleeAttacks2', 'MeleeAttacks3',
            'GroundCarapace1', 'GroundCarapace2', 'GroundCarapace3',
            'MissileAttacks1', 'MissileAttacks2', 'MissileAttacks3',
            'FlyerAttacks1', 'FlyerAttacks2', 'FlyerAttacks3',
            '+1Attack', '+1Armor'
        ]
    }
}


def extract_build_order_events(snapshots: List[Dict[str, Any]], race: str) -> List[Dict[str, Any]]:
    """
    Extract first appearance of buildings, units, and upgrades from snapshots.

    Args:
        snapshots: List of snapshot dictionaries (must be sorted by game_time_seconds)
        race: Player's race (Terran, Protoss, or Zerg)

    Returns:
        List of event dictionaries with keys:
        - event_type: 'building', 'unit', or 'upgrade'
        - item_name: Name of the building/unit/upgrade
        - game_time_seconds: Time when it first appeared
        - is_milestone: Boolean indicating if this is a key milestone
    """
    events = []
    seen_buildings: Set[str] = set()
    seen_units: Set[str] = set()
    seen_upgrades: Set[str] = set()

    # Get milestones for this race
    milestones = MACRO_MILESTONES.get(race, {})
    milestone_buildings = set(milestones.get('buildings', []))
    milestone_units = set(milestones.get('units', []))
    milestone_upgrades = set(milestones.get('upgrades', []))

    for snapshot in snapshots:
        time = snapshot['game_time_seconds']

        # Detect when buildings first appear (count goes 0 → 1+)
        if snapshot.get('buildings'):
            buildings = json.loads(snapshot['buildings']) if isinstance(snapshot['buildings'], str) else snapshot['buildings']
            for building, count in buildings.items():
                if count > 0 and building not in seen_buildings:
                    seen_buildings.add(building)
                    events.append({
                        'event_type': 'building',
                        'item_name': building,
                        'game_time_seconds': time,
                        'is_milestone': building in milestone_buildings
                    })

        # Detect when units first appear
        if snapshot.get('units'):
            units = json.loads(snapshot['units']) if isinstance(snapshot['units'], str) else snapshot['units']
            for unit, count in units.items():
                if count > 0 and unit not in seen_units:
                    seen_units.add(unit)
                    events.append({
                        'event_type': 'unit',
                        'item_name': unit,
                        'game_time_seconds': time,
                        'is_milestone': unit in milestone_units
                    })

        # Detect when upgrades complete
        if snapshot.get('upgrades'):
            upgrades = json.loads(snapshot['upgrades']) if isinstance(snapshot['upgrades'], str) else snapshot['upgrades']
            # Upgrades is typically a list of completed upgrade names
            if isinstance(upgrades, list):
                for upgrade in upgrades:
                    if upgrade and upgrade not in seen_upgrades:
                        seen_upgrades.add(upgrade)
                        events.append({
                            'event_type': 'upgrade',
                            'item_name': upgrade,
                            'game_time_seconds': time,
                            'is_milestone': upgrade in milestone_upgrades
                        })
            # Or it might be a dict with counts
            elif isinstance(upgrades, dict):
                for upgrade, completed in upgrades.items():
                    if completed and upgrade not in seen_upgrades:
                        seen_upgrades.add(upgrade)
                        events.append({
                            'event_type': 'upgrade',
                            'item_name': upgrade,
                            'game_time_seconds': time,
                            'is_milestone': upgrade in milestone_upgrades
                        })

    return events


def format_time(seconds: int) -> str:
    """Format seconds as MM:SS."""
    minutes = seconds // 60
    secs = seconds % 60
    return f"{minutes}:{secs:02d}"


def analyze_timing_differences(
    user_events: List[Dict[str, Any]],
    pro_events_sets: List[List[Dict[str, Any]]]
) -> Dict[str, Any]:
    """
    Analyze timing differences between user and pro build orders.

    Args:
        user_events: User's build order events
        pro_events_sets: List of pro game build order events (one list per pro game)

    Returns:
        Dictionary with analysis results:
        - comparisons: List of timing comparisons for each milestone
        - user_missing: Milestones pros built that user didn't
        - user_extra: Things user built that pros didn't
    """
    if not pro_events_sets:
        return {'comparisons': [], 'user_missing': [], 'user_extra': []}

    # Build dictionaries for quick lookup: item_name -> time
    user_timings = {
        f"{e['event_type']}:{e['item_name']}": e['game_time_seconds']
        for e in user_events
    }

    # Calculate average pro timings
    pro_timings: Dict[str, List[int]] = {}
    for pro_events in pro_events_sets:
        for event in pro_events:
            key = f"{event['event_type']}:{event['item_name']}"
            if key not in pro_timings:
                pro_timings[key] = []
            pro_timings[key].append(event['game_time_seconds'])

    pro_avg_timings = {
        key: sum(times) / len(times)
        for key, times in pro_timings.items()
    }

    # Compare timings
    comparisons = []
    for key, pro_avg_time in pro_avg_timings.items():
        event_type, item_name = key.split(':', 1)

        if key in user_timings:
            user_time = user_timings[key]
            difference = user_time - pro_avg_time
            comparisons.append({
                'event_type': event_type,
                'item_name': item_name,
                'user_time': user_time,
                'pro_avg_time': pro_avg_time,
                'difference': difference,
                'status': 'early' if difference < -5 else ('late' if difference > 5 else 'on-time')
            })

    # Sort by user time
    comparisons.sort(key=lambda x: x['user_time'])

    # Find missing/extra items (only milestones matter)
    user_milestone_set = {
        f"{e['event_type']}:{e['item_name']}"
        for e in user_events
        if e.get('is_milestone', False)
    }

    pro_milestone_set = {
        key for key in pro_avg_timings.keys()
        # Check if any pro game marked it as milestone
        if any(
            e.get('is_milestone', False)
            for pro_events in pro_events_sets
            for e in pro_events
            if f"{e['event_type']}:{e['item_name']}" == key
        )
    }

    user_missing = [
        {'event_type': key.split(':', 1)[0], 'item_name': key.split(':', 1)[1], 'pro_avg_time': pro_avg_timings[key]}
        for key in (pro_milestone_set - user_milestone_set)
    ]

    user_extra = [
        {'event_type': key.split(':', 1)[0], 'item_name': key.split(':', 1)[1], 'user_time': user_timings[key]}
        for key in (user_milestone_set - pro_milestone_set)
    ]

    return {
        'comparisons': comparisons,
        'user_missing': user_missing,
        'user_extra': user_extra
    }

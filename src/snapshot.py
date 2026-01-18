"""
Game state tracking and snapshot generation.
"""
import json
from typing import Dict, Any, Set, Optional
from collections import defaultdict

from src.constants import UNIT_COSTS, WORKER_UNITS, BASE_BUILDINGS


# Units to ignore (not real combat units)
IGNORED_UNITS = {
    # Beacon markers
    'BeaconArmy', 'BeaconDefend', 'BeaconAttack', 'BeaconHarass', 'BeaconIdle',
    'BeaconAuto', 'BeaconDetect', 'BeaconScout', 'BeaconClaim', 'BeaconExpand',
    'BeaconRally', 'BeaconCustom1', 'BeaconCustom2', 'BeaconCustom3', 'BeaconCustom4',

    # Temporary/helper units
    'Larva', 'Broodling', 'Interceptor', 'MULE', 'Changeling', 'ChangelingZealot',
    'ChangelingMarine', 'ChangelingMarineShield', 'ChangelingZergling', 'ChangelingZerglingWings',
    'InvisibleTargetDummy', 'KD8Charge', 'OracleStasisTrap', 'CreepTumorQueen',
    'CreepTumor', 'CreepTumorBurrowed', 'AutoTurret', 'PointDefenseDrone',
    'Locust', 'LocustFlying',

    # Cocoons/morphing states (handled by mapping below)
    'BanelingCocoon', 'LurkerCocoon', 'BroodLordCocoon', 'RavagerCocoon',
    'OverlordTransportCocoon', 'OverseerCocoon',
}

# Map morphed/transformed units to their base form
UNIT_MORPHS = {
    # Protoss
    'AdeptPhaseShift': 'Adept',
    'ObserverSiegeMode': 'Observer',
    'WarpPrismPhasing': 'WarpPrism',

    # Terran
    'SiegeTankSieged': 'SiegeTank',
    'WidowMineBurrowed': 'WidowMine',
    'VikingFighter': 'Viking',
    'VikingAssault': 'Viking',
    'LiberatorAG': 'Liberator',
    'HellionTank': 'Hellbat',

    # Zerg
    'LurkerBurrowed': 'Lurker',
    'RoachBurrowed': 'Roach',
    'InfestorBurrowed': 'Infestor',
    'SwarmHostBurrowed': 'SwarmHost',
    'OverlordTransport': 'Overlord',
    'OverseerSiegeMode': 'Overseer',
    'BanelingBurrowed': 'Baneling',
    'ZerglingBurrowed': 'Zergling',
    'DroneBurrowed': 'Drone',
    'HydraliskBurrowed': 'Hydralisk',
    'QueenBurrowed': 'Queen',
    'UltraliskBurrowed': 'Ultralisk',
}


class GameState:
    """Tracks player state as events are processed"""

    def __init__(self, player, player_number: int):
        self.player = player
        self.player_number = player_number
        self.race = player.play_race

        # Unit and building tracking
        self.units = defaultdict(int)  # {unit_type: count}
        self.buildings = defaultdict(int)  # {building_type: count}
        self.upgrades = {}  # {upgrade_name: completed}

        # Resource tracking
        self.unspent_minerals = 0
        self.unspent_gas = 0
        self.total_minerals_collected = 0
        self.total_gas_collected = 0
        self.resources_spent_minerals = 0
        self.resources_spent_gas = 0

        # Collection rates (will be calculated from periodic stats)
        self.mineral_collection_rate = 0
        self.gas_collection_rate = 0

        # Combat tracking
        self.units_killed_value = 0
        self.units_lost_value = 0

        # Unit object tracking for detailed analysis
        self.alive_units = {}  # {unit_id: unit_object}

    def normalize_unit_name(self, unit_name: str) -> Optional[str]:
        """
        Normalize unit name by mapping morphs to base form and filtering ignored units.

        Args:
            unit_name: Raw unit name from replay

        Returns:
            Normalized unit name, or None if unit should be ignored
        """
        # Ignore beacon and temporary units
        if unit_name in IGNORED_UNITS:
            return None

        # Map morphed units to base form
        if unit_name in UNIT_MORPHS:
            return UNIT_MORPHS[unit_name]

        return unit_name

    def process_event(self, event):
        """Update state based on event type"""
        event_type = event.name

        if event_type == 'UnitBornEvent':
            self._handle_unit_born(event)
        elif event_type == 'UnitDiedEvent':
            self._handle_unit_died(event)
        elif event_type == 'UnitDoneEvent':
            self._handle_unit_done(event)
        elif event_type == 'UpgradeCompleteEvent':
            self._handle_upgrade_complete(event)
        elif event_type == 'PlayerStatsEvent':
            self._handle_player_stats(event)

    def _handle_unit_born(self, event):
        """Handle unit/building birth"""
        if not hasattr(event, 'unit') or event.unit is None:
            return

        unit = event.unit
        if not hasattr(unit, 'owner') or unit.owner != self.player:
            return

        # Normalize unit name
        unit_type = self.normalize_unit_name(unit.name)
        if unit_type is None:
            return

        # Track unit/building
        if hasattr(unit, 'is_building') and unit.is_building:
            self.buildings[unit_type] += 1
        else:
            self.units[unit_type] += 1

        # Store unit reference (use original unit for tracking)
        if hasattr(unit, 'id'):
            self.alive_units[unit.id] = unit

    def _handle_unit_done(self, event):
        """Handle unit/building completion (for buildings mainly)"""
        if not hasattr(event, 'unit') or event.unit is None:
            return

        unit = event.unit
        if not hasattr(unit, 'owner') or unit.owner != self.player:
            return

        # Normalize unit name
        unit_type = self.normalize_unit_name(unit.name)
        if unit_type is None:
            return

        # Some units might only appear in UnitDoneEvent
        if hasattr(unit, 'is_building') and unit.is_building:
            if unit_type not in self.buildings or self.buildings[unit_type] == 0:
                self.buildings[unit_type] += 1

        # Calculate resource cost for spending tracking
        if unit_type in UNIT_COSTS:
            cost = UNIT_COSTS[unit_type]
            self.resources_spent_minerals += cost['minerals']
            self.resources_spent_gas += cost['gas']

    def _handle_unit_died(self, event):
        """Handle unit/building death"""
        if not hasattr(event, 'unit') or event.unit is None:
            return

        unit = event.unit

        # Normalize unit name
        unit_type = self.normalize_unit_name(unit.name)
        if unit_type is None:
            return

        # Check if this unit belonged to us
        if hasattr(unit, 'owner') and unit.owner == self.player:
            # Remove from our counts
            if hasattr(unit, 'is_building') and unit.is_building:
                if self.buildings[unit_type] > 0:
                    self.buildings[unit_type] -= 1
            else:
                if self.units[unit_type] > 0:
                    self.units[unit_type] -= 1

            # Track value lost
            if unit_type in UNIT_COSTS:
                cost = UNIT_COSTS[unit_type]
                self.units_lost_value += cost['minerals'] + cost['gas']

            # Remove from alive units
            if hasattr(unit, 'id') and unit.id in self.alive_units:
                del self.alive_units[unit.id]

        # Check if we killed an enemy unit
        elif hasattr(event, 'killer') and event.killer is not None:
            if hasattr(event.killer, 'owner') and event.killer.owner == self.player:
                if unit_type in UNIT_COSTS:
                    cost = UNIT_COSTS[unit_type]
                    self.units_killed_value += cost['minerals'] + cost['gas']

    def _handle_upgrade_complete(self, event):
        """Handle upgrade completion"""
        if not hasattr(event, 'player') or event.player != self.player:
            return

        if hasattr(event, 'upgrade_type_name'):
            upgrade_name = event.upgrade_type_name

            # Filter out cosmetic/non-gameplay upgrades
            if self._is_cosmetic_upgrade(upgrade_name):
                return

            self.upgrades[upgrade_name] = True

    def _is_cosmetic_upgrade(self, upgrade_name: str) -> bool:
        """Check if upgrade is cosmetic (not gameplay-affecting)"""
        cosmetic_prefixes = [
            'Reward',           # RewardDance*, RewardSkin*, etc.
            'Spray',            # Spray emotes
            'GameHeart',        # Tournament mode cosmetics
            'VoicePack',        # Voice packs
            'Skin',             # Unit skins
            'Decal',            # Decals
            'Announcer',        # Announcers
            'Console',          # Console skins
            'Emote',            # Emotes
        ]

        for prefix in cosmetic_prefixes:
            if upgrade_name.startswith(prefix):
                return True

        return False

    def _handle_player_stats(self, event):
        """Handle periodic player stats updates"""
        if not hasattr(event, 'player') or event.player != self.player:
            return

        # Update unspent resources
        if hasattr(event, 'minerals_current'):
            self.unspent_minerals = event.minerals_current
        if hasattr(event, 'vespene_current'):
            self.unspent_gas = event.vespene_current

        # Update collection totals
        if hasattr(event, 'minerals_collection_rate'):
            self.mineral_collection_rate = event.minerals_collection_rate
        if hasattr(event, 'vespene_collection_rate'):
            self.gas_collection_rate = event.vespene_collection_rate

        # Update total collected
        if hasattr(event, 'minerals_used_in_progress_army') and hasattr(event, 'minerals_used_in_progress_economy') and hasattr(event, 'minerals_used_in_progress_technology'):
            # Total minerals = unspent + spent on various things
            total_spent = (
                getattr(event, 'minerals_used_in_progress_army', 0) +
                getattr(event, 'minerals_used_in_progress_economy', 0) +
                getattr(event, 'minerals_used_in_progress_technology', 0) +
                getattr(event, 'minerals_used_current_army', 0) +
                getattr(event, 'minerals_used_current_economy', 0) +
                getattr(event, 'minerals_used_current_technology', 0)
            )
            self.total_minerals_collected = self.unspent_minerals + total_spent

        # Similar for gas
        if hasattr(event, 'vespene_used_in_progress_army'):
            total_gas_spent = (
                getattr(event, 'vespene_used_in_progress_army', 0) +
                getattr(event, 'vespene_used_in_progress_economy', 0) +
                getattr(event, 'vespene_used_in_progress_technology', 0) +
                getattr(event, 'vespene_used_current_army', 0) +
                getattr(event, 'vespene_used_current_economy', 0) +
                getattr(event, 'vespene_used_current_technology', 0)
            )
            self.total_gas_collected = self.unspent_gas + total_gas_spent

    def get_snapshot(self, game_time_seconds: int) -> Dict[str, Any]:
        """
        Calculate all metrics at this game time.

        Args:
            game_time_seconds: Current game time in seconds

        Returns:
            Dictionary containing all snapshot metrics
        """
        worker_count = self._count_workers()
        army_value_minerals = self._calculate_army_value('minerals')
        army_value_gas = self._calculate_army_value('gas')
        army_supply = self._calculate_army_supply()
        base_count = self._count_bases()

        # Calculate efficiencies
        collection_efficiency = self._calculate_collection_efficiency()
        spending_efficiency = self._calculate_spending_efficiency()

        # Filter out units and buildings with 0 counts
        units_filtered = {k: v for k, v in self.units.items() if v > 0}
        buildings_filtered = {k: v for k, v in self.buildings.items() if v > 0}

        return {
            'game_time_seconds': game_time_seconds,
            'player_number': self.player_number,
            'race': self.race,

            # Economy
            'worker_count': worker_count,
            'mineral_collection_rate': self.mineral_collection_rate,
            'gas_collection_rate': self.gas_collection_rate,
            'unspent_minerals': self.unspent_minerals,
            'unspent_gas': self.unspent_gas,
            'total_minerals_collected': self.total_minerals_collected,
            'total_gas_collected': self.total_gas_collected,

            # Army
            'army_value_minerals': army_value_minerals,
            'army_value_gas': army_value_gas,
            'army_supply': army_supply,
            'units': json.dumps(units_filtered),

            # Buildings
            'buildings': json.dumps(buildings_filtered),

            # Upgrades
            'upgrades': json.dumps(self.upgrades),

            # Map Control
            'base_count': base_count,
            'vision_area': 0.0,  # Placeholder
            'unit_map_presence': json.dumps({}),  # Placeholder

            # Combat/Efficiency
            'units_killed_value': self.units_killed_value,
            'units_lost_value': self.units_lost_value,
            'resources_spent_minerals': self.resources_spent_minerals,
            'resources_spent_gas': self.resources_spent_gas,
            'collection_efficiency': collection_efficiency,
            'spending_efficiency': spending_efficiency
        }

    def _count_workers(self) -> int:
        """Count worker units"""
        count = 0
        for unit_type, num in self.units.items():
            if unit_type in WORKER_UNITS:
                count += num
        return count

    def _calculate_army_value(self, resource_type: str) -> int:
        """Calculate total army value in minerals or gas"""
        total = 0
        for unit_type, count in self.units.items():
            if unit_type not in WORKER_UNITS and unit_type in UNIT_COSTS:
                cost = UNIT_COSTS[unit_type]
                total += cost[resource_type] * count
        return total

    def _calculate_army_supply(self) -> int:
        """Calculate total army supply"""
        total = 0
        for unit_type, count in self.units.items():
            if unit_type not in WORKER_UNITS and unit_type in UNIT_COSTS:
                supply = UNIT_COSTS[unit_type]['supply']
                total += supply * count
        return int(total)

    def _count_bases(self) -> int:
        """Count base buildings (town halls)"""
        count = 0
        for building_type, num in self.buildings.items():
            if building_type in BASE_BUILDINGS:
                count += num
        return count

    def _calculate_collection_efficiency(self) -> float:
        """
        Calculate collection efficiency.
        Ratio of resources collected to theoretical maximum.
        """
        if self.total_minerals_collected == 0:
            return 0.0

        # Simplified efficiency metric
        worker_count = self._count_workers()
        if worker_count == 0:
            return 0.0

        # Rough estimate: optimal is ~1 mineral per second per worker
        # This is simplified; actual calculation would be more complex
        return min(1.0, self.mineral_collection_rate / (worker_count * 1.0))

    def _calculate_spending_efficiency(self) -> float:
        """
        Calculate spending efficiency.
        How well are resources being spent vs accumulated.
        """
        total_collected = self.total_minerals_collected + self.total_gas_collected
        if total_collected == 0:
            return 1.0

        total_unspent = self.unspent_minerals + self.unspent_gas
        efficiency = 1.0 - (total_unspent / max(total_collected, 1))

        return max(0.0, min(1.0, efficiency))

"""
Tests for snapshot generation and GameState.
"""
import json
from unittest.mock import Mock
from src.snapshot import GameState
from src.constants import WORKER_UNITS, BASE_BUILDINGS, UNIT_COSTS


def create_mock_player(name="TestPlayer", race="Terran"):
    """Create a mock player object."""
    player = Mock()
    player.name = name
    player.play_race = race
    return player


def test_worker_count():
    """Test worker counting."""
    player = create_mock_player()
    state = GameState(player, 1)

    # Add workers
    state.units['SCV'] = 15
    state.units['Marine'] = 20

    worker_count = state._count_workers()
    assert worker_count == 15


def test_army_value_calculation():
    """Test army value calculation."""
    player = create_mock_player()
    state = GameState(player, 1)

    # Add units
    state.units['Marine'] = 10  # 50 minerals each
    state.units['Marauder'] = 5  # 100 minerals, 25 gas each
    state.units['SCV'] = 20  # Workers should not count

    minerals = state._calculate_army_value('minerals')
    gas = state._calculate_army_value('gas')

    expected_minerals = (10 * 50) + (5 * 100)  # 500 + 500 = 1000
    expected_gas = 5 * 25  # 125

    assert minerals == expected_minerals
    assert gas == expected_gas


def test_army_supply_calculation():
    """Test army supply calculation."""
    player = create_mock_player()
    state = GameState(player, 1)

    # Add units
    state.units['Marine'] = 10  # 1 supply each
    state.units['Marauder'] = 5  # 2 supply each
    state.units['SCV'] = 20  # Workers should not count

    supply = state._calculate_army_supply()
    expected_supply = (10 * 1) + (5 * 2)  # 10 + 10 = 20

    assert supply == expected_supply


def test_base_count():
    """Test base building counting."""
    player = create_mock_player()
    state = GameState(player, 1)

    # Add buildings
    state.buildings['CommandCenter'] = 2
    state.buildings['OrbitalCommand'] = 1
    state.buildings['Barracks'] = 5

    base_count = state._count_bases()
    assert base_count == 3  # 2 CC + 1 Orbital


def test_json_serialization():
    """Test that units and buildings serialize to JSON correctly."""
    player = create_mock_player()
    state = GameState(player, 1)

    # Add some units and buildings
    state.units['Marine'] = 15
    state.units['Medivac'] = 3
    state.buildings['Barracks'] = 4
    state.upgrades['Stim'] = True

    snapshot = state.get_snapshot(100)

    # Verify JSON fields can be parsed
    units = json.loads(snapshot['units'])
    buildings = json.loads(snapshot['buildings'])
    upgrades = json.loads(snapshot['upgrades'])

    assert units['Marine'] == 15
    assert units['Medivac'] == 3
    assert buildings['Barracks'] == 4
    assert upgrades['Stim'] is True


def test_snapshot_structure():
    """Test that snapshot has all required fields."""
    player = create_mock_player()
    state = GameState(player, 1)

    snapshot = state.get_snapshot(100)

    # Check all required fields exist
    required_fields = [
        'game_time_seconds',
        'player_number',
        'race',
        'worker_count',
        'mineral_collection_rate',
        'gas_collection_rate',
        'unspent_minerals',
        'unspent_gas',
        'total_minerals_collected',
        'total_gas_collected',
        'army_value_minerals',
        'army_value_gas',
        'army_supply',
        'units',
        'buildings',
        'upgrades',
        'base_count',
        'vision_area',
        'unit_map_presence',
        'units_killed_value',
        'units_lost_value',
        'resources_spent_minerals',
        'resources_spent_gas',
        'collection_efficiency',
        'spending_efficiency'
    ]

    for field in required_fields:
        assert field in snapshot, f"Missing field: {field}"


def test_efficiency_calculations():
    """Test efficiency metric calculations."""
    player = create_mock_player()
    state = GameState(player, 1)

    # Set up some realistic values
    state.units['SCV'] = 50
    state.mineral_collection_rate = 1000
    state.total_minerals_collected = 5000
    state.total_gas_collected = 2000
    state.unspent_minerals = 500
    state.unspent_gas = 300

    collection_efficiency = state._calculate_collection_efficiency()
    spending_efficiency = state._calculate_spending_efficiency()

    # Collection efficiency should be between 0 and 1
    assert 0.0 <= collection_efficiency <= 1.0

    # Spending efficiency should be between 0 and 1
    assert 0.0 <= spending_efficiency <= 1.0

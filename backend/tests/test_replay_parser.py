import pytest
from pathlib import Path
from core.replay_parser import ReplayParser

@pytest.fixture
def test_replay_path():
    # User must provide a test replay file
    path = Path("tests/fixtures/test_replay.SC2Replay")
    if not path.exists():
        pytest.skip("Test replay file not found. Place a .SC2Replay file at tests/fixtures/test_replay.SC2Replay")
    return str(path)

def test_load_replay(test_replay_path):
    parser = ReplayParser()
    replay = parser.load_replay(test_replay_path)

    assert replay is not None
    assert hasattr(replay, 'players')
    assert len(replay.players) >= 2
    assert hasattr(replay, 'game_length')

def test_extract_game_metadata(test_replay_path):
    parser = ReplayParser()
    replay = parser.load_replay(test_replay_path)
    metadata = parser.extract_game_metadata(replay)

    assert metadata["matchup"] in ["PvP", "PvT", "PvZ", "TvT", "TvZ", "ZvZ"]
    assert metadata["game_length"] > 0
    assert metadata["player_name"] is not None
    assert metadata["opponent_name"] is not None
    assert metadata["player_race"] in ["Protoss", "Terran", "Zerg"]
    assert metadata["opponent_race"] in ["Protoss", "Terran", "Zerg"]

def test_extract_build_events(test_replay_path):
    parser = ReplayParser()
    replay = parser.load_replay(test_replay_path)
    events = parser.extract_build_events(replay, player_index=0)

    assert len(events) > 0

    # Check first event structure
    first_event = events[0]
    assert "game_time" in first_event
    assert "event_type" in first_event
    assert "name" in first_event
    assert first_event["event_type"] in ["unit", "building", "upgrade"]
    assert first_event["game_time"] >= 0

def test_extract_snapshots(test_replay_path):
    parser = ReplayParser()
    replay = parser.load_replay(test_replay_path)
    snapshots = parser.extract_snapshots(replay, player_index=0, interval=5)

    assert len(snapshots) > 0

    # Check snapshot structure
    first = snapshots[0]
    assert "game_time" in first
    assert "worker_count" in first
    assert "army_value" in first
    assert "army_supply" in first
    assert first["game_time"] == 0

    # Check snapshots are at 5-second intervals
    if len(snapshots) > 1:
        assert snapshots[1]["game_time"] == 5

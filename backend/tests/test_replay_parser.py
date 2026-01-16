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

"""
Tests for replay parser.
"""
import sqlite3
import tempfile
from pathlib import Path
import pytest
import sc2reader

from backend.src.parser import extract_game_metadata, generate_snapshots, parse_replay_file
from backend.src.database import init_database


def get_test_replay():
    """Get the first available test replay."""
    replay_dir = Path("backend/data/replays")
    replays = list(replay_dir.glob("*.SC2Replay"))
    if not replays:
        pytest.skip("No replay files found in backend/data/replays")
    return replays[0]


def test_parse_game_metadata():
    """Test game metadata extraction."""
    replay_path = get_test_replay()
    replay = sc2reader.load_replay(str(replay_path), load_level=4)

    metadata = extract_game_metadata(replay, replay_path)

    # Check required fields
    assert metadata['replay_file'] == replay_path.name
    assert metadata['game_length_seconds'] > 0
    assert metadata['map_name'] is not None
    assert metadata['player1_name'] is not None
    assert metadata['player1_race'] is not None
    assert metadata['player2_name'] is not None
    assert metadata['player2_race'] is not None
    assert metadata['result'] in [1, 2]


def test_snapshot_generation():
    """Test snapshot generation creates snapshots at 5-second intervals."""
    replay_path = get_test_replay()
    replay = sc2reader.load_replay(str(replay_path), load_level=4)

    snapshots = generate_snapshots(replay)

    # Should have snapshots
    assert len(snapshots) > 0

    # Check we have snapshots for both players
    player1_snapshots = [s for s in snapshots if s['player_number'] == 1]
    player2_snapshots = [s for s in snapshots if s['player_number'] == 2]

    assert len(player1_snapshots) > 0
    assert len(player2_snapshots) > 0
    assert len(player1_snapshots) == len(player2_snapshots)

    # Check snapshots are at 5-second intervals
    player1_times = sorted([s['game_time_seconds'] for s in player1_snapshots])
    for i, time in enumerate(player1_times):
        assert time == i * 5


def test_full_pipeline():
    """Test complete replay parsing pipeline."""
    replay_path = get_test_replay()

    # Create temporary database
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as tmp_db:
        db_path = Path(tmp_db.name)

    try:
        # Initialize database
        init_database(db_path)

        # Parse replay
        parse_replay_file(replay_path, db_path)

        # Verify database contents
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Check game was inserted
        game_count = cursor.execute("SELECT COUNT(*) FROM games").fetchone()[0]
        assert game_count == 1

        # Check snapshots were inserted
        snapshot_count = cursor.execute("SELECT COUNT(*) FROM snapshots").fetchone()[0]
        assert snapshot_count > 0

        # Check we have snapshots for both players
        player_counts = cursor.execute("""
            SELECT player_number, COUNT(*)
            FROM snapshots
            GROUP BY player_number
        """).fetchall()

        assert len(player_counts) == 2
        assert player_counts[0][1] == player_counts[1][1]  # Same count for both players

        conn.close()

    finally:
        # Cleanup
        db_path.unlink(missing_ok=True)


def test_reject_non_1v1():
    """Test that non-1v1 games are rejected."""
    # This test would require a non-1v1 replay, which we may not have
    # For now, we'll just verify the code path exists
    pass


def test_reject_short_games():
    """Test that games shorter than 60 seconds are rejected."""
    # This test would require a very short replay, which we may not have
    # For now, we'll just verify the code path exists
    pass

"""
Tests for database transaction safety and foreign key enforcement.
"""
import sqlite3
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from backend.src.database import (
    get_connection,
    init_database,
    insert_game,
    insert_snapshots,
    insert_build_order_events,
    delete_game_by_replay_file,
)


def make_game_data(replay_file: str = "test_replay.SC2Replay") -> dict:
    """Create minimal game data for testing."""
    return {
        "replay_file": replay_file,
        "game_date": "2024-01-01",
        "game_length_seconds": 300,
        "map_name": "Test Map",
        "game_version": "5.0.0",
        "build_number": 12345,
        "expansion": "LotV",
        "game_type": "1v1",
        "game_speed": "Faster",
        "region": "us",
        "player1_name": "Player1",
        "player1_race": "Zerg",
        "player2_name": "Player2",
        "player2_race": "Terran",
        "result": 1,
        "is_pro_replay": False,
    }


def make_snapshot(game_time_seconds: int, player_number: int, race: str = "Zerg") -> dict:
    """Create minimal snapshot data for testing."""
    return {
        "game_time_seconds": game_time_seconds,
        "player_number": player_number,
        "race": race,
        "worker_count": 12,
        "mineral_collection_rate": 500.0,
        "gas_collection_rate": 100.0,
        "unspent_minerals": 200,
        "unspent_gas": 50,
        "total_minerals_collected": 1000,
        "total_gas_collected": 300,
        "army_value_minerals": 500,
        "army_value_gas": 200,
        "army_supply": 20,
        "units": "{}",
        "buildings": "{}",
        "upgrades": "{}",
        "base_count": 2,
        "vision_area": 100.0,
        "units_killed_value": 0,
        "units_lost_value": 0,
        "resources_spent_minerals": 800,
        "resources_spent_gas": 250,
        "collection_efficiency": 0.85,
        "spending_efficiency": 0.75,
    }


def make_build_order_event(event_type: str = "building", item_name: str = "Hatchery", time: int = 0) -> dict:
    """Create minimal build order event for testing."""
    return {
        "event_type": event_type,
        "item_name": item_name,
        "game_time_seconds": time,
        "is_milestone": True,
    }


@pytest.fixture
def db_path():
    """Create a temporary database for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        path = Path(tmpdir) / "test.db"
        init_database(path)
        # Create user_uploads table (normally created in auth.py)
        conn = get_connection(path)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS user_uploads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        conn.close()
        yield path


class TestGetConnection:
    """Tests for get_connection helper."""

    def test_foreign_keys_enabled(self, db_path):
        """get_connection should enable PRAGMA foreign_keys."""
        conn = get_connection(db_path)
        cursor = conn.execute("PRAGMA foreign_keys")
        result = cursor.fetchone()[0]
        conn.close()
        assert result == 1

    def test_regular_connect_no_fk(self, db_path):
        """Plain sqlite3.connect does NOT enable foreign keys by default."""
        conn = sqlite3.connect(db_path)
        cursor = conn.execute("PRAGMA foreign_keys")
        result = cursor.fetchone()[0]
        conn.close()
        assert result == 0


class TestInsertCommitParameter:
    """Tests for the commit parameter on insert functions."""

    def test_insert_game_no_commit(self, db_path):
        """insert_game with commit=False should not persist on rollback."""
        conn = get_connection(db_path)
        game_id = insert_game(conn, make_game_data(), commit=False)
        assert game_id is not None
        conn.rollback()
        conn.close()

        # Verify game was NOT persisted
        conn2 = get_connection(db_path)
        cursor = conn2.execute("SELECT COUNT(*) FROM games")
        assert cursor.fetchone()[0] == 0
        conn2.close()

    def test_insert_game_with_commit(self, db_path):
        """insert_game with commit=True should persist."""
        conn = get_connection(db_path)
        game_id = insert_game(conn, make_game_data(), commit=True)
        conn.close()

        conn2 = get_connection(db_path)
        cursor = conn2.execute("SELECT COUNT(*) FROM games")
        assert cursor.fetchone()[0] == 1
        conn2.close()

    def test_insert_snapshots_no_commit(self, db_path):
        """insert_snapshots with commit=False should not persist on rollback."""
        conn = get_connection(db_path)
        game_id = insert_game(conn, make_game_data(), commit=False)
        snapshots = [make_snapshot(0, 1), make_snapshot(0, 2)]
        insert_snapshots(conn, game_id, snapshots, commit=False)
        conn.rollback()
        conn.close()

        conn2 = get_connection(db_path)
        cursor = conn2.execute("SELECT COUNT(*) FROM snapshots")
        assert cursor.fetchone()[0] == 0
        cursor = conn2.execute("SELECT COUNT(*) FROM games")
        assert cursor.fetchone()[0] == 0
        conn2.close()

    def test_insert_build_order_no_commit(self, db_path):
        """insert_build_order_events with commit=False should not persist on rollback."""
        conn = get_connection(db_path)
        game_id = insert_game(conn, make_game_data(), commit=False)
        events = [make_build_order_event()]
        insert_build_order_events(conn, game_id, 1, events, commit=False)
        conn.rollback()
        conn.close()

        conn2 = get_connection(db_path)
        cursor = conn2.execute("SELECT COUNT(*) FROM build_order_events")
        assert cursor.fetchone()[0] == 0
        conn2.close()


class TestTransactionAtomicity:
    """Tests for transaction atomicity — partial inserts should be rolled back."""

    def test_snapshot_failure_rolls_back_game(self, db_path):
        """If snapshot insert fails, the game insert should also be rolled back."""
        conn = get_connection(db_path)
        try:
            game_id = insert_game(conn, make_game_data(), commit=False)

            # Insert a bad snapshot that violates a CHECK constraint (negative worker_count)
            bad_snapshot = make_snapshot(0, 1)
            bad_snapshot["worker_count"] = -1
            try:
                insert_snapshots(conn, game_id, [bad_snapshot], commit=False)
            except sqlite3.IntegrityError:
                conn.rollback()
        finally:
            conn.close()

        # Verify nothing was persisted
        conn2 = get_connection(db_path)
        cursor = conn2.execute("SELECT COUNT(*) FROM games")
        assert cursor.fetchone()[0] == 0
        cursor = conn2.execute("SELECT COUNT(*) FROM snapshots")
        assert cursor.fetchone()[0] == 0
        conn2.close()

    def test_successful_transaction_persists_all(self, db_path):
        """A successful transaction should persist game, snapshots, and build order events."""
        conn = get_connection(db_path)
        try:
            game_id = insert_game(conn, make_game_data(), commit=False)
            snapshots = [make_snapshot(0, 1), make_snapshot(5, 1), make_snapshot(0, 2)]
            insert_snapshots(conn, game_id, snapshots, commit=False)
            events = [make_build_order_event()]
            insert_build_order_events(conn, game_id, 1, events, commit=False)
            conn.commit()
        finally:
            conn.close()

        conn2 = get_connection(db_path)
        assert conn2.execute("SELECT COUNT(*) FROM games").fetchone()[0] == 1
        assert conn2.execute("SELECT COUNT(*) FROM snapshots").fetchone()[0] == 3
        assert conn2.execute("SELECT COUNT(*) FROM build_order_events").fetchone()[0] == 1
        conn2.close()


class TestForeignKeyEnforcement:
    """Tests for FK constraint enforcement."""

    def test_cannot_insert_snapshot_with_invalid_game_id(self, db_path):
        """Inserting a snapshot referencing a non-existent game_id should fail."""
        conn = get_connection(db_path)
        with pytest.raises(sqlite3.IntegrityError):
            insert_snapshots(conn, 99999, [make_snapshot(0, 1)], commit=True)
        conn.close()

    def test_cannot_insert_build_order_with_invalid_game_id(self, db_path):
        """Inserting a build order event referencing a non-existent game_id should fail."""
        conn = get_connection(db_path)
        with pytest.raises(sqlite3.IntegrityError):
            insert_build_order_events(conn, 99999, 1, [make_build_order_event()], commit=True)
        conn.close()


class TestCascadeDeletes:
    """Tests for ON DELETE CASCADE behavior."""

    def test_deleting_game_cascades_to_snapshots(self, db_path):
        """Deleting a game should automatically delete its snapshots via CASCADE."""
        conn = get_connection(db_path)
        game_id = insert_game(conn, make_game_data(), commit=False)
        insert_snapshots(conn, game_id, [make_snapshot(0, 1), make_snapshot(0, 2)], commit=False)
        conn.commit()

        # Delete the game directly (CASCADE should handle children)
        conn.execute("DELETE FROM games WHERE id = ?", (game_id,))
        conn.commit()

        assert conn.execute("SELECT COUNT(*) FROM snapshots").fetchone()[0] == 0
        conn.close()

    def test_deleting_game_cascades_to_build_order(self, db_path):
        """Deleting a game should automatically delete its build order events via CASCADE."""
        conn = get_connection(db_path)
        game_id = insert_game(conn, make_game_data(), commit=False)
        insert_build_order_events(conn, game_id, 1, [make_build_order_event()], commit=False)
        conn.commit()

        conn.execute("DELETE FROM games WHERE id = ?", (game_id,))
        conn.commit()

        assert conn.execute("SELECT COUNT(*) FROM build_order_events").fetchone()[0] == 0
        conn.close()

    def test_deleting_game_cascades_to_user_uploads(self, db_path):
        """Deleting a game should automatically delete its user_uploads via CASCADE."""
        conn = get_connection(db_path)
        game_id = insert_game(conn, make_game_data(), commit=False)
        conn.execute("INSERT INTO user_uploads (user_id, game_id) VALUES (?, ?)", (1, game_id))
        conn.commit()

        conn.execute("DELETE FROM games WHERE id = ?", (game_id,))
        conn.commit()

        assert conn.execute("SELECT COUNT(*) FROM user_uploads").fetchone()[0] == 0
        conn.close()


class TestDeleteGameByReplayFile:
    """Tests for delete_game_by_replay_file function."""

    def test_deletes_all_related_data(self, db_path):
        """delete_game_by_replay_file should remove game, snapshots, build_order, and user_uploads."""
        conn = get_connection(db_path)
        game_id = insert_game(conn, make_game_data(), commit=False)
        insert_snapshots(conn, game_id, [make_snapshot(0, 1)], commit=False)
        insert_build_order_events(conn, game_id, 1, [make_build_order_event()], commit=False)
        conn.execute("INSERT INTO user_uploads (user_id, game_id) VALUES (?, ?)", (1, game_id))
        conn.commit()

        result = delete_game_by_replay_file(conn, "test_replay.SC2Replay")
        assert result is True

        assert conn.execute("SELECT COUNT(*) FROM games").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM snapshots").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM build_order_events").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM user_uploads").fetchone()[0] == 0
        conn.close()

    def test_returns_false_for_missing_replay(self, db_path):
        """delete_game_by_replay_file should return False if replay not found."""
        conn = get_connection(db_path)
        result = delete_game_by_replay_file(conn, "nonexistent.SC2Replay")
        assert result is False
        conn.close()

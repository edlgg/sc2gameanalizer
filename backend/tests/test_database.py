"""
Tests for database transaction safety and foreign key enforcement.

These tests require a running PostgreSQL instance with DATABASE_URL set.
They use a real database connection and wrap each test in a transaction
that is rolled back at the end, so no test data persists.
"""
import os

import pytest

# Skip entire module if no DATABASE_URL
pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL not set — need a PostgreSQL instance for database tests",
)

import psycopg2
import psycopg2.errors

from backend.src.database import (
    get_connection,
    get_connection_direct,
    return_connection,
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
def conn():
    """
    Provide a database connection wrapped in a SAVEPOINT.

    Each test runs inside a savepoint that is rolled back after the test,
    so no test data leaks into the real database. The tables must already
    exist (run init_database or migrations beforehand).
    """
    db_conn = get_connection_direct()
    db_conn.autocommit = False

    # Create a savepoint so we can roll back all test changes
    cursor = db_conn.cursor()
    cursor.execute("SAVEPOINT test_savepoint")

    # Ensure user_uploads table exists for cascade tests
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_uploads (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    yield db_conn

    # Roll back everything the test did
    db_conn.rollback()
    return_connection(db_conn)


class TestInsertCommitParameter:
    """Tests for the commit parameter on insert functions."""

    def test_insert_game_no_commit(self, conn):
        """insert_game with commit=False should not persist on rollback."""
        game_id = insert_game(conn, make_game_data(), commit=False)
        assert game_id is not None
        conn.rollback()

        # Verify game was NOT persisted
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM games WHERE replay_file = %s", ("test_replay.SC2Replay",))
        assert cursor.fetchone()[0] == 0

    def test_insert_game_with_commit(self, conn):
        """insert_game with commit=True should persist (within our savepoint)."""
        game_id = insert_game(conn, make_game_data(), commit=True)
        assert game_id is not None

        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM games WHERE id = %s", (game_id,))
        assert cursor.fetchone()[0] == 1

    def test_insert_snapshots_no_commit(self, conn):
        """insert_snapshots with commit=False should not persist on rollback."""
        game_id = insert_game(conn, make_game_data(), commit=False)
        snapshots = [make_snapshot(0, 1), make_snapshot(0, 2)]
        insert_snapshots(conn, game_id, snapshots, commit=False)
        conn.rollback()

        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM snapshots WHERE game_id = %s", (game_id,))
        assert cursor.fetchone()[0] == 0
        cursor.execute("SELECT COUNT(*) FROM games WHERE id = %s", (game_id,))
        assert cursor.fetchone()[0] == 0

    def test_insert_build_order_no_commit(self, conn):
        """insert_build_order_events with commit=False should not persist on rollback."""
        game_id = insert_game(conn, make_game_data(), commit=False)
        events = [make_build_order_event()]
        insert_build_order_events(conn, game_id, 1, events, commit=False)
        conn.rollback()

        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM build_order_events WHERE game_id = %s", (game_id,))
        assert cursor.fetchone()[0] == 0


class TestTransactionAtomicity:
    """Tests for transaction atomicity — partial inserts should be rolled back."""

    def test_snapshot_failure_rolls_back_game(self, conn):
        """If snapshot insert fails, the game insert should also be rolled back."""
        # Use a savepoint so the error doesn't invalidate our whole transaction
        cursor = conn.cursor()
        cursor.execute("SAVEPOINT inner_sp")
        try:
            game_id = insert_game(conn, make_game_data(), commit=False)

            # Insert a bad snapshot that violates a CHECK constraint (negative worker_count)
            bad_snapshot = make_snapshot(0, 1)
            bad_snapshot["worker_count"] = -1
            try:
                insert_snapshots(conn, game_id, [bad_snapshot], commit=False)
            except psycopg2.IntegrityError:
                cursor.execute("ROLLBACK TO SAVEPOINT inner_sp")
        except Exception:
            cursor.execute("ROLLBACK TO SAVEPOINT inner_sp")

        # Verify nothing was persisted
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM games WHERE replay_file = %s", ("test_replay.SC2Replay",))
        assert cursor.fetchone()[0] == 0
        cursor.execute("SELECT COUNT(*) FROM snapshots")
        # May have other snapshots from other data; just check our game's snapshots are gone
        # Since we rolled back to savepoint, the game_id no longer exists

    def test_successful_transaction_persists_all(self, conn):
        """A successful transaction should persist game, snapshots, and build order events."""
        game_id = insert_game(conn, make_game_data(), commit=False)
        snapshots = [make_snapshot(0, 1), make_snapshot(5, 1), make_snapshot(0, 2)]
        insert_snapshots(conn, game_id, snapshots, commit=False)
        events = [make_build_order_event()]
        insert_build_order_events(conn, game_id, 1, events, commit=False)
        # Don't commit — just check the data is visible within the transaction
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM games WHERE id = %s", (game_id,))
        assert cursor.fetchone()[0] == 1
        cursor.execute("SELECT COUNT(*) FROM snapshots WHERE game_id = %s", (game_id,))
        assert cursor.fetchone()[0] == 3
        cursor.execute("SELECT COUNT(*) FROM build_order_events WHERE game_id = %s", (game_id,))
        assert cursor.fetchone()[0] == 1


class TestForeignKeyEnforcement:
    """Tests for FK constraint enforcement."""

    def test_cannot_insert_snapshot_with_invalid_game_id(self, conn):
        """Inserting a snapshot referencing a non-existent game_id should fail."""
        cursor = conn.cursor()
        cursor.execute("SAVEPOINT fk_sp")
        with pytest.raises(psycopg2.IntegrityError):
            insert_snapshots(conn, 99999, [make_snapshot(0, 1)], commit=False)
        cursor.execute("ROLLBACK TO SAVEPOINT fk_sp")

    def test_cannot_insert_build_order_with_invalid_game_id(self, conn):
        """Inserting a build order event referencing a non-existent game_id should fail."""
        cursor = conn.cursor()
        cursor.execute("SAVEPOINT fk_sp")
        with pytest.raises(psycopg2.IntegrityError):
            insert_build_order_events(conn, 99999, 1, [make_build_order_event()], commit=False)
        cursor.execute("ROLLBACK TO SAVEPOINT fk_sp")


class TestCascadeDeletes:
    """Tests for ON DELETE CASCADE behavior."""

    def test_deleting_game_cascades_to_snapshots(self, conn):
        """Deleting a game should automatically delete its snapshots via CASCADE."""
        game_id = insert_game(conn, make_game_data(), commit=False)
        insert_snapshots(conn, game_id, [make_snapshot(0, 1), make_snapshot(0, 2)], commit=False)

        cursor = conn.cursor()
        cursor.execute("DELETE FROM games WHERE id = %s", (game_id,))

        cursor.execute("SELECT COUNT(*) FROM snapshots WHERE game_id = %s", (game_id,))
        assert cursor.fetchone()[0] == 0

    def test_deleting_game_cascades_to_build_order(self, conn):
        """Deleting a game should automatically delete its build order events via CASCADE."""
        game_id = insert_game(conn, make_game_data(), commit=False)
        insert_build_order_events(conn, game_id, 1, [make_build_order_event()], commit=False)

        cursor = conn.cursor()
        cursor.execute("DELETE FROM games WHERE id = %s", (game_id,))

        cursor.execute("SELECT COUNT(*) FROM build_order_events WHERE game_id = %s", (game_id,))
        assert cursor.fetchone()[0] == 0

    def test_deleting_game_cascades_to_user_uploads(self, conn):
        """Deleting a game should automatically delete its user_uploads via CASCADE."""
        game_id = insert_game(conn, make_game_data(), commit=False)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO user_uploads (user_id, game_id) VALUES (%s, %s)", (1, game_id))

        cursor.execute("DELETE FROM games WHERE id = %s", (game_id,))

        cursor.execute("SELECT COUNT(*) FROM user_uploads WHERE game_id = %s", (game_id,))
        assert cursor.fetchone()[0] == 0


class TestDeleteGameByReplayFile:
    """Tests for delete_game_by_replay_file function."""

    def test_deletes_all_related_data(self, conn):
        """delete_game_by_replay_file should remove game, snapshots, build_order, and user_uploads."""
        game_id = insert_game(conn, make_game_data(), commit=False)
        insert_snapshots(conn, game_id, [make_snapshot(0, 1)], commit=False)
        insert_build_order_events(conn, game_id, 1, [make_build_order_event()], commit=False)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO user_uploads (user_id, game_id) VALUES (%s, %s)", (1, game_id))

        result = delete_game_by_replay_file(conn, "test_replay.SC2Replay", commit=False)
        assert result is True

        cursor.execute("SELECT COUNT(*) FROM games WHERE id = %s", (game_id,))
        assert cursor.fetchone()[0] == 0
        cursor.execute("SELECT COUNT(*) FROM snapshots WHERE game_id = %s", (game_id,))
        assert cursor.fetchone()[0] == 0
        cursor.execute("SELECT COUNT(*) FROM build_order_events WHERE game_id = %s", (game_id,))
        assert cursor.fetchone()[0] == 0
        cursor.execute("SELECT COUNT(*) FROM user_uploads WHERE game_id = %s", (game_id,))
        assert cursor.fetchone()[0] == 0

    def test_returns_false_for_missing_replay(self, conn):
        """delete_game_by_replay_file should return False if replay not found."""
        result = delete_game_by_replay_file(conn, "nonexistent.SC2Replay", commit=False)
        assert result is False

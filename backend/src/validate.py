"""
Validation logic for snapshot database.
"""
import sqlite3
from pathlib import Path


def main():
    """Run validation checks on the snapshot database."""
    db_path = Path("backend/data/replays.db")

    if not db_path.exists():
        print(f"ERROR: Database not found at {db_path}")
        print("Run 'task generate' first to create the database.")
        return

    print("=" * 60)
    print("Validating snapshot database")
    print("=" * 60)
    print()

    validate_database_counts(db_path)
    print()
    validate_sanity_checks(db_path)
    print()
    validate_against_game_stats(db_path)
    print()

    print("=" * 60)
    print("Validation complete!")
    print("=" * 60)


def validate_database_counts(db_path: Path) -> None:
    """Check basic database counts."""
    print("Database Counts:")
    print("-" * 40)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Count games
    game_count = cursor.execute("SELECT COUNT(*) FROM games").fetchone()[0]
    print(f"  Games:     {game_count}")

    # Count snapshots
    snapshot_count = cursor.execute("SELECT COUNT(*) FROM snapshots").fetchone()[0]
    print(f"  Snapshots: {snapshot_count}")

    # Average snapshots per game
    if game_count > 0:
        avg_snapshots = snapshot_count / game_count
        print(f"  Avg snapshots per game: {avg_snapshots:.1f}")

    conn.close()


def validate_sanity_checks(db_path: Path) -> None:
    """Check values are within reasonable ranges."""
    print("Sanity Checks (Outlier Detection):")
    print("-" * 40)

    conn = sqlite3.connect(db_path)

    checks = [
        ("worker_count", 0, 200),
        ("mineral_collection_rate", 0, 5000),  # Can be very high with 80+ workers on multiple bases
        ("gas_collection_rate", 0, 3000),
        ("army_supply", 0, 200),
        ("base_count", 0, 20),
        ("unspent_minerals", 0, 50000),
        ("unspent_gas", 0, 50000),
    ]

    total_outliers = 0

    for field, min_val, max_val in checks:
        outliers = conn.execute(f"""
            SELECT game_id, game_time_seconds, player_number, {field}
            FROM snapshots
            WHERE {field} < ? OR {field} > ?
        """, (min_val, max_val)).fetchall()

        if outliers:
            print(f"  ⚠ {field}: {len(outliers)} outliers found")
            total_outliers += len(outliers)
            # Show first few examples
            for game_id, time, player, value in outliers[:3]:
                print(f"      Game {game_id}, Player {player}, Time {time}s: {value}")
        else:
            print(f"  ✓ {field}: All values in range [{min_val}, {max_val}]")

    if total_outliers == 0:
        print()
        print("  All sanity checks passed! ✓")
    else:
        print()
        print(f"  Total outliers found: {total_outliers}")

    conn.close()


def validate_against_game_stats(db_path: Path) -> None:
    """Compare with game-level statistics."""
    print("Game Statistics Summary:")
    print("-" * 40)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Get final snapshot statistics for each game
    games = cursor.execute("SELECT id, replay_file, game_length_seconds FROM games").fetchall()

    if not games:
        print("  No games found in database")
        conn.close()
        return

    # Show summary for first few games
    print(f"  Showing summary for first 3 games:")
    print()

    for game_id, replay_file, length in games[:3]:
        print(f"  Game {game_id}: {replay_file}")
        print(f"    Length: {length}s ({length // 60}m {length % 60}s)")

        # Get final snapshots for both players
        final_snapshots = cursor.execute("""
            SELECT player_number, total_minerals_collected, total_gas_collected,
                   units_killed_value, units_lost_value, army_supply
            FROM snapshots
            WHERE game_id = ?
            ORDER BY game_time_seconds DESC, player_number
            LIMIT 2
        """, (game_id,)).fetchall()

        for player_num, minerals, gas, killed, lost, supply in final_snapshots:
            print(f"    Player {player_num}:")
            print(f"      Resources collected: {minerals} minerals, {gas} gas")
            print(f"      Combat: {killed} killed value, {lost} lost value")
            print(f"      Final army supply: {supply}")

        print()

    conn.close()


if __name__ == "__main__":
    main()

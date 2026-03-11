"""
Validation logic for snapshot database.
"""
from backend.src.database import get_connection

# Whitelist of valid snapshot column names to prevent SQL injection
VALID_SNAPSHOT_COLUMNS = {
    "worker_count", "mineral_collection_rate", "gas_collection_rate",
    "unspent_minerals", "unspent_gas", "total_minerals_collected", "total_gas_collected",
    "army_value_minerals", "army_value_gas", "army_supply",
    "base_count", "vision_area",
    "units_killed_value", "units_lost_value",
    "resources_spent_minerals", "resources_spent_gas",
    "collection_efficiency", "spending_efficiency",
    "supply_used", "supply_cap",
}


def main():
    """Run validation checks on the snapshot database."""
    print("=" * 60)
    print("Validating snapshot database")
    print("=" * 60)
    print()

    validate_database_counts()
    print()
    validate_sanity_checks()
    print()
    validate_against_game_stats()
    print()

    print("=" * 60)
    print("Validation complete!")
    print("=" * 60)


def validate_database_counts() -> None:
    """Check basic database counts."""
    print("Database Counts:")
    print("-" * 40)

    with get_connection() as conn:
        cursor = conn.cursor()

        # Count games
        cursor.execute("SELECT COUNT(*) FROM games")
        game_count = cursor.fetchone()[0]
        print(f"  Games:     {game_count}")

        # Count snapshots
        cursor.execute("SELECT COUNT(*) FROM snapshots")
        snapshot_count = cursor.fetchone()[0]
        print(f"  Snapshots: {snapshot_count}")

        # Average snapshots per game
        if game_count > 0:
            avg_snapshots = snapshot_count / game_count
            print(f"  Avg snapshots per game: {avg_snapshots:.1f}")


def validate_sanity_checks() -> None:
    """Check values are within reasonable ranges."""
    print("Sanity Checks (Outlier Detection):")
    print("-" * 40)

    with get_connection() as conn:
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
        cursor = conn.cursor()

        for field, min_val, max_val in checks:
            if field not in VALID_SNAPSHOT_COLUMNS:
                raise ValueError(f"Invalid field name: {field}")
            cursor.execute(f"""
                SELECT game_id, game_time_seconds, player_number, {field}
                FROM snapshots
                WHERE {field} < %s OR {field} > %s
            """, (min_val, max_val))
            outliers = cursor.fetchall()

            if outliers:
                print(f"  WARNING {field}: {len(outliers)} outliers found")
                total_outliers += len(outliers)
                # Show first few examples
                for game_id, time, player, value in outliers[:3]:
                    print(f"      Game {game_id}, Player {player}, Time {time}s: {value}")
            else:
                print(f"  OK {field}: All values in range [{min_val}, {max_val}]")

        if total_outliers == 0:
            print()
            print("  All sanity checks passed!")
        else:
            print()
            print(f"  Total outliers found: {total_outliers}")


def validate_against_game_stats() -> None:
    """Compare with game-level statistics."""
    print("Game Statistics Summary:")
    print("-" * 40)

    with get_connection() as conn:
        cursor = conn.cursor()

        # Get final snapshot statistics for each game
        cursor.execute("SELECT id, replay_file, game_length_seconds FROM games")
        games = cursor.fetchall()

        if not games:
            print("  No games found in database")
            return

        # Show summary for first few games
        print(f"  Showing summary for first 3 games:")
        print()

        for game_id, replay_file, length in games[:3]:
            print(f"  Game {game_id}: {replay_file}")
            print(f"    Length: {length}s ({length // 60}m {length % 60}s)")

            # Get final snapshots for both players
            cursor.execute("""
                SELECT player_number, total_minerals_collected, total_gas_collected,
                       units_killed_value, units_lost_value, army_supply
                FROM snapshots
                WHERE game_id = %s
                ORDER BY game_time_seconds DESC, player_number
                LIMIT 2
            """, (game_id,))
            final_snapshots = cursor.fetchall()

            for player_num, minerals, gas, killed, lost, supply in final_snapshots:
                print(f"    Player {player_num}:")
                print(f"      Resources collected: {minerals} minerals, {gas} gas")
                print(f"      Combat: {killed} killed value, {lost} lost value")
                print(f"      Final army supply: {supply}")

            print()


if __name__ == "__main__":
    main()

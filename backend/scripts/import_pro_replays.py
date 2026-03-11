"""
Import pro replay data from snapshots.db to PostgreSQL.

This script:
1. Deletes existing pro replays from the database (with old buggy base counts)
2. Imports all games from snapshots.db into PostgreSQL
3. Marks them as pro replays (is_pro_replay = true)

Note: snapshots.db is a legacy SQLite file used as a one-time import source.
"""
import sqlite3
from pathlib import Path

from backend.src.database import get_connection_direct, return_connection


def main():
    snapshots_db = Path("backend/data/snapshots.db")

    if not snapshots_db.exists():
        print(f"Error: {snapshots_db} not found")
        print("   Run 'python -m src.generate' first to create it")
        return

    print("=" * 60)
    print("IMPORTING PRO REPLAYS")
    print("=" * 60)

    # Connect to source SQLite database
    source_conn = sqlite3.connect(snapshots_db)
    source_cursor = source_conn.cursor()

    # Connect to target PostgreSQL database
    target_conn = get_connection_direct()
    target_cursor = target_conn.cursor()

    try:
        # Step 1: Check what's in each database
        source_cursor.execute("SELECT COUNT(*) FROM games")
        source_count = source_cursor.fetchone()[0]

        target_cursor.execute("SELECT COUNT(*) FROM games WHERE is_pro_replay = true")
        old_pro_count = target_cursor.fetchone()[0]

        target_cursor.execute("SELECT COUNT(*) FROM games WHERE is_pro_replay = false")
        user_count = target_cursor.fetchone()[0]

        print(f"\nCurrent state:")
        print(f"  snapshots.db: {source_count} games (with fixed base counts)")
        print(f"  PostgreSQL:   {old_pro_count} pro + {user_count} user = {old_pro_count + user_count} total")

        # Step 2: Delete old pro replays from PostgreSQL
        print(f"\nDeleting {old_pro_count} old pro replays from PostgreSQL...")
        target_cursor.execute("DELETE FROM games WHERE is_pro_replay = true")
        target_conn.commit()

        # Step 3: Get all data from snapshots.db
        print(f"\nImporting {source_count} games from snapshots.db...")

        # Get games
        source_cursor.execute("""
            SELECT replay_file, game_date, game_length_seconds, map_name,
                   game_version, build_number, expansion, game_type, game_speed, region,
                   player1_name, player1_race, player2_name, player2_race, result
            FROM games
        """)
        games = source_cursor.fetchall()

        # Get mapping of old IDs to replay files
        source_cursor.execute("SELECT id, replay_file FROM games")
        id_to_file = {row[0]: row[1] for row in source_cursor.fetchall()}

        # Insert games into PostgreSQL (marked as pro replays)
        game_id_mapping = {}  # old_id -> new_id
        skipped = 0
        for game in games:
            replay_file = game[0]

            # Check if this replay already exists in PostgreSQL
            target_cursor.execute("SELECT id, is_pro_replay FROM games WHERE replay_file = %s", (replay_file,))
            existing = target_cursor.fetchone()

            if existing:
                existing_id, is_pro = existing
                if is_pro:
                    # Already exists as pro replay, skip
                    skipped += 1
                else:
                    # Exists as user replay, update to mark as pro replay
                    print(f"   WARNING {replay_file} exists as user replay, marking as pro...")
                    target_cursor.execute("UPDATE games SET is_pro_replay = true WHERE id = %s", (existing_id,))
                    new_id = existing_id

                    # Find old ID by replay_file
                    old_id = None
                    for oid, rfile in id_to_file.items():
                        if rfile == replay_file:
                            old_id = oid
                            break

                    if old_id:
                        game_id_mapping[old_id] = new_id
                continue

            # Insert new game
            target_cursor.execute("""
                INSERT INTO games (
                    replay_file, game_date, game_length_seconds, map_name,
                    game_version, build_number, expansion, game_type, game_speed, region,
                    player1_name, player1_race, player2_name, player2_race, result,
                    is_pro_replay
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true)
                RETURNING id
            """, game)
            new_id = target_cursor.fetchone()[0]

            # Find old ID by replay_file
            old_id = None
            for oid, rfile in id_to_file.items():
                if rfile == replay_file:
                    old_id = oid
                    break

            if old_id:
                game_id_mapping[old_id] = new_id

        print(f"   Imported {len(games) - skipped} games (skipped {skipped} duplicates)")

        # Step 4: Import snapshots (only for newly imported games)
        print(f"\nImporting snapshots...")
        source_cursor.execute("SELECT COUNT(*) FROM snapshots")
        total_snapshots = source_cursor.fetchone()[0]

        imported_snapshots = 0
        for old_game_id, new_game_id in game_id_mapping.items():
            # Check if snapshots already exist for this game
            target_cursor.execute("SELECT COUNT(*) FROM snapshots WHERE game_id = %s", (new_game_id,))
            existing_snapshot_count = target_cursor.fetchone()[0]

            if existing_snapshot_count > 0:
                # Snapshots already exist, need to delete old ones and replace with new corrected data
                print(f"   Replacing {existing_snapshot_count} old snapshots for game {new_game_id}...")
                target_cursor.execute("DELETE FROM snapshots WHERE game_id = %s", (new_game_id,))

            source_cursor.execute("""
                SELECT game_time_seconds, player_number, race,
                       worker_count, mineral_collection_rate, gas_collection_rate,
                       unspent_minerals, unspent_gas, total_minerals_collected, total_gas_collected,
                       army_value_minerals, army_value_gas, army_supply, units,
                       buildings, upgrades, base_count, vision_area,
                       units_killed_value, units_lost_value,
                       resources_spent_minerals, resources_spent_gas,
                       collection_efficiency, spending_efficiency
                FROM snapshots
                WHERE game_id = ?
            """, (old_game_id,))

            snapshots = source_cursor.fetchall()
            for snapshot in snapshots:
                target_cursor.execute("""
                    INSERT INTO snapshots (
                        game_id, game_time_seconds, player_number, race,
                        worker_count, mineral_collection_rate, gas_collection_rate,
                        unspent_minerals, unspent_gas, total_minerals_collected, total_gas_collected,
                        army_value_minerals, army_value_gas, army_supply, units,
                        buildings, upgrades, base_count, vision_area,
                        units_killed_value, units_lost_value,
                        resources_spent_minerals, resources_spent_gas,
                        collection_efficiency, spending_efficiency
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (new_game_id,) + snapshot)
                imported_snapshots += 1

        print(f"   Imported {imported_snapshots} snapshots")

        # Step 5: Import build order events if they exist
        source_cursor.execute("SELECT COUNT(*) FROM build_order_events")
        total_events = source_cursor.fetchone()[0]

        if total_events > 0:
            print(f"\nImporting {total_events} build order events...")
            imported_events = 0
            for old_game_id, new_game_id in game_id_mapping.items():
                # Check if events already exist for this game
                target_cursor.execute("SELECT COUNT(*) FROM build_order_events WHERE game_id = %s", (new_game_id,))
                existing_events_count = target_cursor.fetchone()[0]

                if existing_events_count > 0:
                    # Events already exist, delete and replace
                    target_cursor.execute("DELETE FROM build_order_events WHERE game_id = %s", (new_game_id,))

                source_cursor.execute("""
                    SELECT player_number, event_type, item_name, game_time_seconds, is_milestone
                    FROM build_order_events
                    WHERE game_id = ?
                """, (old_game_id,))

                events = source_cursor.fetchall()
                for event in events:
                    target_cursor.execute("""
                        INSERT INTO build_order_events (
                            game_id, player_number, event_type, item_name,
                            game_time_seconds, is_milestone
                        ) VALUES (%s, %s, %s, %s, %s, %s)
                    """, (new_game_id,) + event)
                    imported_events += 1

            print(f"   Imported {imported_events} events")

        # Commit and close
        target_conn.commit()
        source_conn.close()

        # Step 6: Verify
        target_cursor.execute("SELECT COUNT(*) FROM games WHERE is_pro_replay = true")
        new_pro_count = target_cursor.fetchone()[0]

        target_cursor.execute("""
            SELECT MAX(base_count)
            FROM snapshots
            WHERE game_id IN (SELECT id FROM games WHERE is_pro_replay = true)
        """)
        max_bases = target_cursor.fetchone()[0]

        print("\n" + "=" * 60)
        print("IMPORT COMPLETE!")
        print("=" * 60)
        print(f"  Pro replays in PostgreSQL: {new_pro_count}")
        print(f"  Max base_count in pro games: {max_bases} (was 2, should be 3+)")
        print(f"  User replays preserved: {user_count}")
        print("=" * 60)

    except Exception:
        target_conn.rollback()
        raise
    finally:
        return_connection(target_conn)


if __name__ == "__main__":
    main()

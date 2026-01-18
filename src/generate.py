"""
Main entry point for generating snapshot database from replay files.
"""
from pathlib import Path

from src.database import init_database
from src.parser import parse_replay_file


def main():
    """Process all replay files and generate snapshot database."""
    replay_dir = Path("data/replays")
    db_path = Path("data/snapshots.db")

    print(f"Initializing database at {db_path}...")
    init_database(db_path)

    replay_files = sorted(replay_dir.glob("*.SC2Replay"))
    total_replays = len(replay_files)

    print(f"Found {total_replays} replay files")
    print()


    for i, replay_file in enumerate(replay_files, 1):
        print(f"[{i}/{total_replays}] Processing {replay_file.name}...", end=" ")
        try:
            parse_replay_file(replay_file, db_path)
            print("✓")
        except Exception as e:
            raise e

    print()
    print("=" * 60)
    print(f"Processing complete!")
    print(f"  Total:   {total_replays}")
    print(f"  Database: {db_path}")
    print("=" * 60)


if __name__ == "__main__":
    main()

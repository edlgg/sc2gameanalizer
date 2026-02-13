"""
Main entry point for generating snapshot database from replay files.
"""
from pathlib import Path

from backend.src.database import init_database
from backend.src.parser import parse_replay_file


def main():
    """Process all replay files and generate snapshot database."""
    replay_dir = Path("backend/data/replays")
    db_path = Path("backend/data/replays.db")  # Changed from snapshots.db to match backend

    print(f"Initializing database at {db_path}...")
    init_database(db_path)

    replay_files = sorted(replay_dir.glob("*.SC2Replay"))
    total_replays = len(replay_files)

    print(f"Found {total_replays} replay files")
    print()

    # Track statistics
    processed = 0
    skipped = []

    for i, replay_file in enumerate(replay_files, 1):
        print(f"[{i}/{total_replays}] Processing {replay_file.name}...", end=" ")
        try:
            parse_replay_file(replay_file, db_path)
            print("✓")
            processed += 1
        except ValueError as e:
            # Skip invalid replays (non-1v1, too short, etc.)
            print(f"⏭️  SKIP: {e}")
            skipped.append((replay_file.name, str(e)))
        except (IndexError, KeyError, AttributeError) as e:
            # Skip corrupted or unparseable replays
            print(f"⏭️  SKIP: Corrupted/unparseable replay ({type(e).__name__}: {e})")
            skipped.append((replay_file.name, f"Corrupted/unparseable ({type(e).__name__})"))
        except Exception as e:
            # Log and continue — one bad replay should not abort the batch
            print(f"⚠️  SKIPPED {replay_file.name}: {type(e).__name__}: {e}")
            skipped.append((replay_file.name, str(e)))
            continue

    print()
    print("=" * 60)
    print(f"Processing complete!")
    print(f"  Total:      {total_replays}")
    print(f"  Processed:  {processed}")
    print(f"  Skipped:    {len(skipped)}")
    print(f"  Database:   {db_path}")

    if skipped:
        print()
        print("Skipped replays:")
        for filename, reason in skipped:
            print(f"  • {filename}: {reason}")

    print("=" * 60)


if __name__ == "__main__":
    main()

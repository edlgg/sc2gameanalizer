#!/usr/bin/env python3
"""
Generate pro games database from replay files.

Usage:
    python -m core.generate_pro_database

Reads all .SC2Replay files from data/replays/ and processes them into data/pro_games.db
"""

import sys
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from db.base import Base, init_db
from models import Game, BuildEvent, Snapshot, ProGame
from core.replay_parser import ReplayParser
from core.build_signature import BuildSignatureGenerator
from core.database_writer import DatabaseWriter


def main():
    # Setup database
    db_path = Path("data/pro_games.db")
    db_path.parent.mkdir(exist_ok=True)

    engine = create_engine(f"sqlite:///{db_path}")
    init_db(engine)
    Session = sessionmaker(bind=engine)

    # Find all replay files
    replays_dir = Path("data/replays")
    if not replays_dir.exists():
        print(f"Error: {replays_dir} does not exist")
        print("Please create data/replays/ and add .SC2Replay files")
        return 1

    replay_files = list(replays_dir.glob("*.SC2Replay")) + list(replays_dir.glob("*.sc2replay"))

    if not replay_files:
        print(f"No replay files found in {replays_dir}")
        print("Please add .SC2Replay files to data/replays/")
        return 1

    print(f"Found {len(replay_files)} replay files")

    # Process each replay
    parser = ReplayParser()
    sig_gen = BuildSignatureGenerator()

    session = Session()
    writer = DatabaseWriter(session)

    successful = 0
    failed = 0

    for i, replay_path in enumerate(replay_files, 1):
        print(f"\n[{i}/{len(replay_files)}] Processing {replay_path.name}...")

        try:
            # Parse replay
            replay = parser.load_replay(str(replay_path))
            metadata = parser.extract_game_metadata(replay)
            events = parser.extract_build_events(replay, player_index=0)
            snapshots = parser.extract_snapshots(replay, player_index=0)

            # Generate signature
            signature = sig_gen.generate_signature(events, max_time=480)

            # Write to database
            game_id = writer.write_game(
                metadata=metadata,
                events=events,
                snapshots=snapshots,
                is_pro=True,
                build_signature=signature,
                build_label=None  # Could add manual labels
            )

            print(f"  ✓ Game ID {game_id} - {metadata['player_name']} vs {metadata['opponent_name']} ({metadata['matchup']})")
            successful += 1

        except Exception as e:
            print(f"  ✗ Failed: {e}")
            failed += 1
            continue

    print(f"\n{'='*60}")
    print(f"Processing complete!")
    print(f"  Successful: {successful}")
    print(f"  Failed: {failed}")
    print(f"  Database: {db_path}")
    print(f"{'='*60}")

    session.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())

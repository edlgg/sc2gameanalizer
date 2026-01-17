"""Batch processor - orchestrates replay processing."""

from pathlib import Path
from typing import Dict, List


def process_replays(replays_dir: str, db_path: str) -> Dict[str, List[str]]:
    """
    Process all replay files in directory.

    Args:
        replays_dir: Directory containing .SC2Replay files
        db_path: Path to output database

    Returns:
        Dictionary with 'succeeded' and 'failed' lists
    """
    # Implementation in Step 8
    pass


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 3:
        print("Usage: python -m src.processor <replays_dir> <db_path>")
        sys.exit(1)

    replays_dir = sys.argv[1]
    db_path = sys.argv[2]

    result = process_replays(replays_dir, db_path)
    print(f"Processing complete: {len(result['succeeded'])} succeeded, {len(result['failed'])} failed")

"""
Similarity matching algorithm to find pro games similar to user games.

Algorithm considers:
1. Matchup (PvZ, TvZ, etc.) - mandatory
2. Game length similarity
3. Map similarity (optional)
4. Macro pattern similarity at key timestamps (3min, 6min, 9min)
"""
from pathlib import Path
from typing import List, Dict, Any, Tuple
import math

from backend.src.database import get_connection


def get_matchup(player1_race: str, player2_race: str, player_perspective: int = 1) -> str:
    """
    Get matchup string from player's perspective.

    Args:
        player1_race: Race of player 1
        player2_race: Race of player 2
        player_perspective: Which player's perspective (1 or 2)

    Returns:
        Matchup string like "PvZ", "TvT", etc.
    """
    if player_perspective == 1:
        return f"{player1_race[0]}v{player2_race[0]}"
    else:
        return f"{player2_race[0]}v{player1_race[0]}"


def calculate_game_length_similarity(length1: int, length2: int) -> float:
    """
    Calculate similarity based on game length.
    Returns score between 0 and 1 (1 = perfect match).

    Args:
        length1: Game length in seconds
        length2: Game length in seconds

    Returns:
        Similarity score (0-1)
    """
    # Games within 2 minutes (120s) are considered very similar
    # Games more than 10 minutes (600s) apart are considered very different
    diff = abs(length1 - length2)

    if diff <= 120:
        return 1.0
    elif diff >= 600:
        return 0.0
    else:
        # Linear interpolation between 120s and 600s
        return 1.0 - ((diff - 120) / 480)


def calculate_macro_similarity(snapshots1: List[Tuple], snapshots2: List[Tuple]) -> float:
    """
    Calculate similarity based on macro patterns at key timestamps.

    Compares:
    - Worker count at 3min, 6min, 9min
    - Army value at 6min, 9min, 12min
    - Base count at 6min, 12min

    Args:
        snapshots1: Snapshots from first game (game_time, worker_count, army_value, base_count)
        snapshots2: Snapshots from second game

    Returns:
        Similarity score (0-1)
    """
    # Key timestamps to compare (in seconds)
    key_times = [180, 360, 540, 720]  # 3min, 6min, 9min, 12min

    scores = []

    for time_point in key_times:
        # Find snapshots closest to this timestamp
        snap1 = find_closest_snapshot(snapshots1, time_point)
        snap2 = find_closest_snapshot(snapshots2, time_point)

        if not snap1 or not snap2:
            continue

        # Compare worker counts (important for early/mid game)
        if time_point <= 540:  # First 9 minutes
            worker_diff = abs(snap1[1] - snap2[1])
            worker_score = max(0, 1.0 - (worker_diff / 30))  # 30 workers = max penalty
            scores.append(worker_score)

        # Compare army values (important for mid/late game)
        if time_point >= 360:  # After 6 minutes
            army1 = snap1[2] + snap1[3]  # minerals + gas value
            army2 = snap2[2] + snap2[3]
            army_diff = abs(army1 - army2)
            army_score = max(0, 1.0 - (army_diff / 5000))  # 5000 resources = max penalty
            scores.append(army_score)

        # Compare base counts (expansion timing)
        if time_point >= 360:  # After 6 minutes
            base_diff = abs(snap1[4] - snap2[4])
            base_score = max(0, 1.0 - (base_diff / 2))  # 2 base difference = max penalty
            scores.append(base_score)

    if not scores:
        return 0.5  # Neutral score if no data

    return sum(scores) / len(scores)


def find_closest_snapshot(snapshots: List[Tuple], target_time: int) -> Tuple:
    """
    Find snapshot closest to target time.

    Args:
        snapshots: List of (time, worker_count, army_minerals, army_gas, base_count)
        target_time: Target time in seconds

    Returns:
        Closest snapshot tuple or None
    """
    if not snapshots:
        return None

    closest = min(snapshots, key=lambda s: abs(s[0] - target_time))

    # Only return if within 30 seconds of target
    if abs(closest[0] - target_time) <= 30:
        return closest

    return None


def find_similar_games(
    db_path: Path,
    user_game_id: int,
    limit: int = 3,
    player_perspective: int = 1
) -> List[Dict[str, Any]]:
    """
    Find the most similar pro games to a user's game.

    Args:
        db_path: Path to SQLite database
        user_game_id: ID of the user's game
        limit: Number of similar games to return
        player_perspective: Which player to analyze (1 or 2)

    Returns:
        List of similar games with similarity scores
    """
    with get_connection(db_path) as conn:
        cursor = conn.cursor()

        # Get user's game metadata
        cursor.execute("""
            SELECT game_length_seconds, map_name, player1_race, player2_race
            FROM games
            WHERE id = ?
        """, (user_game_id,))

        user_game = cursor.fetchone()
        if not user_game:
            return []

        user_length, user_map, user_p1_race, user_p2_race = user_game
        user_matchup = get_matchup(user_p1_race, user_p2_race, player_perspective)

        # Get user's snapshots for macro comparison
        cursor.execute("""
            SELECT game_time_seconds, worker_count, army_value_minerals, army_value_gas, base_count
            FROM snapshots
            WHERE game_id = ? AND player_number = ?
            ORDER BY game_time_seconds
        """, (user_game_id, player_perspective))

        user_snapshots = cursor.fetchall()

        # Get user's race based on player perspective
        user_race = user_p1_race if player_perspective == 1 else user_p2_race

        # Find pro games with EXACT matchup match (critical fix)
        # If user plays PvZ, only match PvZ games (not PvT or PvP)
        cursor.execute("""
            SELECT id, game_length_seconds, map_name, player1_race, player2_race,
                   player1_name, player2_name, game_date
            FROM games
            WHERE is_pro_replay = 1
              AND (
                  (player1_race = ? AND player2_race = ?)
                  OR
                  (player1_race = ? AND player2_race = ?)
              )
        """, (user_p1_race, user_p2_race, user_p2_race, user_p1_race))

        pro_games = cursor.fetchall()

        if not pro_games:
            return []

        # Determine player perspective for each pro game
        pro_game_perspectives = {}
        for pro_game in pro_games:
            pro_id, pro_length, pro_map, pro_p1_race, pro_p2_race, pro_p1_name, pro_p2_name, pro_date = pro_game
            if pro_p1_race == user_p1_race and pro_p2_race == user_p2_race:
                pro_game_perspectives[pro_id] = player_perspective
            elif pro_p1_race == user_p2_race and pro_p2_race == user_p1_race:
                pro_game_perspectives[pro_id] = 2 if player_perspective == 1 else 1

        # Batch-load ALL pro game snapshots in a single query (fixes N+1)
        pro_ids = list(pro_game_perspectives.keys())
        placeholders = ','.join('?' * len(pro_ids))
        cursor.execute(f"""
            SELECT game_id, player_number, game_time_seconds, worker_count,
                   army_value_minerals, army_value_gas, base_count
            FROM snapshots
            WHERE game_id IN ({placeholders})
            ORDER BY game_id, game_time_seconds
        """, pro_ids)

        # Group snapshots by (game_id, player_number)
        from collections import defaultdict
        all_pro_snapshots: dict = defaultdict(list)
        for row in cursor.fetchall():
            gid, pnum, time_s, workers, army_min, army_gas, bases = row
            all_pro_snapshots[(gid, pnum)].append((time_s, workers, army_min, army_gas, bases))

        # Calculate similarity scores for each pro game
        similarities = []

        for pro_game in pro_games:
            pro_id, pro_length, pro_map, pro_p1_race, pro_p2_race, pro_p1_name, pro_p2_name, pro_date = pro_game

            if pro_id not in pro_game_perspectives:
                continue
            pro_player_num = pro_game_perspectives[pro_id]

            # Get pre-loaded snapshots for this pro game + player
            pro_snapshots = all_pro_snapshots.get((pro_id, pro_player_num), [])

            # Calculate component scores
            length_score = calculate_game_length_similarity(user_length, pro_length)
            macro_score = calculate_macro_similarity(user_snapshots, pro_snapshots)

            # Map bonus (10% boost if same map)
            map_bonus = 0.1 if user_map and pro_map and user_map == pro_map else 0.0

            # Overall similarity (weighted average, clamped to [0, 1])
            overall_score = min(1.0, max(0.0,
                length_score * 0.3 +
                macro_score * 0.7 +
                map_bonus
            ))

            # Determine which player's name and race we're comparing against
            matched_player_name = pro_p1_name if pro_player_num == 1 else pro_p2_name
            matched_player_race = pro_p1_race if pro_player_num == 1 else pro_p2_race

            similarities.append({
                "game_id": pro_id,
                "similarity_score": overall_score,
                "length_score": length_score,
                "macro_score": macro_score,
                "map_match": user_map == pro_map if user_map and pro_map else False,
                "game_length_seconds": pro_length,
                "map_name": pro_map,
                "player1_name": pro_p1_name,
                "player2_name": pro_p2_name,
                "player1_race": pro_p1_race,
                "player2_race": pro_p2_race,
                "game_date": pro_date,
                "matchup": user_matchup,
                "matched_player_number": pro_player_num,
                "matched_player_name": matched_player_name,
                "matched_player_race": matched_player_race
            })

    # Sort by similarity score (descending) and return top N
    similarities.sort(key=lambda x: x["similarity_score"], reverse=True)

    return similarities[:limit]

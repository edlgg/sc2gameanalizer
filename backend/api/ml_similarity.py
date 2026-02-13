"""
ML-based similarity matching using scikit-learn embeddings.

This module provides advanced game similarity matching by:
1. Extracting rich feature vectors from game data
2. Using embeddings and clustering for similarity
3. Caching embeddings for performance
"""
import json
import logging
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity

from backend.src.database import get_connection

logger = logging.getLogger(__name__)


class GameEmbedder:
    """
    Converts SC2 game data into feature vectors (embeddings) for similarity matching.
    """

    def __init__(self, cache_path: Optional[Path] = None):
        """
        Initialize the embedder.

        Args:
            cache_path: Optional path to cache embeddings
        """
        self.scaler = StandardScaler()
        self.cache_path = cache_path
        self.embeddings_cache: Dict[int, np.ndarray] = {}
        self._load_cache()

    def _load_cache(self):
        """Load cached embeddings if available."""
        if self.cache_path and self.cache_path.exists():
            try:
                with open(self.cache_path, 'r') as f:
                    data = json.load(f)
                    # Convert string keys back to (game_id, player_number) tuples
                    # and lists back to numpy arrays
                    raw = data.get('embeddings', {})
                    self.embeddings_cache = {
                        tuple(json.loads(k)): np.array(v, dtype=np.float32)
                        for k, v in raw.items()
                    }
                    # Scaler is not cached in JSON — start fresh
                    self.scaler = StandardScaler()
                    logger.debug(f"Loaded {len(self.embeddings_cache)} cached embeddings")
            except (json.JSONDecodeError, KeyError, ValueError) as e:
                logger.warning(f"Cache file corrupted, starting fresh: {e}")
                self.embeddings_cache = {}
            except PermissionError as e:
                logger.warning(f"Cannot read cache file (permission denied): {e}")
            except Exception as e:
                logger.warning(f"Unexpected error loading cache, starting fresh: {e}")
                self.embeddings_cache = {}

    def _save_cache(self):
        """Save embeddings to cache."""
        if self.cache_path:
            try:
                self.cache_path.parent.mkdir(parents=True, exist_ok=True)
                # Convert tuple keys to JSON strings and numpy arrays to lists
                serializable = {
                    json.dumps(list(k)): v.tolist()
                    for k, v in self.embeddings_cache.items()
                }
                with open(self.cache_path, 'w') as f:
                    json.dump({'embeddings': serializable}, f)
            except PermissionError as e:
                logger.warning(f"Cannot write cache file (permission denied): {e}")
            except OSError as e:
                logger.warning(f"Cannot save cache (disk error): {e}")

    def extract_features(
        self,
        snapshots: List[Dict[str, Any]],
        game_length: int,
        build_events: Optional[List[Dict]] = None
    ) -> np.ndarray:
        """
        Extract feature vector from game snapshots.

        Features include:
        - Time-series features at key percentiles (economy, army, bases)
        - Strategic metrics (aggression, expansion timing, spending)
        - Build order features (key building timings normalized by game length)

        Args:
            snapshots: List of game snapshots
            game_length: Game length in seconds
            build_events: Optional build order events

        Returns:
            Feature vector as numpy array
        """
        if not snapshots or game_length == 0:
            return np.zeros(self._get_feature_dimension())

        features = []

        # 1. Time-series features at key percentiles
        time_percentiles = [0.1, 0.25, 0.5, 0.75, 0.9]  # 10%, 25%, 50%, 75%, 90%

        for percentile in time_percentiles:
            target_time = int(game_length * percentile)
            snap = self._find_closest_snapshot(snapshots, target_time)

            if snap:
                features.extend([
                    snap.get('worker_count', 0),
                    snap.get('army_value_minerals', 0) + snap.get('army_value_gas', 0),
                    snap.get('base_count', 0),
                    snap.get('collection_rate_minerals', 0),
                    snap.get('collection_rate_gas', 0),
                ])
            else:
                features.extend([0, 0, 0, 0, 0])

        # 2. Economic metrics (averaged over game)
        avg_workers = np.mean([s.get('worker_count', 0) for s in snapshots])
        avg_collection = np.mean([
            s.get('collection_rate_minerals', 0) + s.get('collection_rate_gas', 0)
            for s in snapshots
        ])
        avg_unspent = np.mean([
            s.get('unspent_resources_minerals', 0) + s.get('unspent_resources_gas', 0)
            for s in snapshots
        ])

        features.extend([avg_workers, avg_collection, avg_unspent])

        # 3. Military metrics (averaged over mid-late game)
        mid_late_snapshots = [
            s for s in snapshots
            if s.get('game_time_seconds', 0) >= game_length * 0.3
        ]

        if mid_late_snapshots:
            avg_army = np.mean([
                s.get('army_value_minerals', 0) + s.get('army_value_gas', 0)
                for s in mid_late_snapshots
            ])
            max_army = max([
                s.get('army_value_minerals', 0) + s.get('army_value_gas', 0)
                for s in mid_late_snapshots
            ])
        else:
            avg_army = 0
            max_army = 0

        features.extend([avg_army, max_army])

        # 4. Strategic metrics
        # Expansion timing (when did 2nd, 3rd, 4th base complete?)
        for target_bases in [2, 3, 4]:
            expansion_time = self._get_expansion_timing(snapshots, target_bases, game_length)
            features.append(expansion_time)

        # Aggression level (army value relative to economy early-mid game)
        aggression = self._calculate_aggression(snapshots, game_length)
        features.append(aggression)

        # Spending efficiency
        spending_eff = self._calculate_spending_efficiency(snapshots)
        features.append(spending_eff)

        # 5. Build order features (if available)
        if build_events:
            build_features = self._extract_build_features(build_events, game_length)
            features.extend(build_features)
        else:
            # Pad with zeros if no build order data
            features.extend([0] * 10)

        # 6. Unit composition features (if units data available)
        composition_features = self._extract_composition_features(snapshots)
        features.extend(composition_features)

        return np.array(features, dtype=np.float32)

    def _get_feature_dimension(self) -> int:
        """Get the expected feature vector dimension."""
        # 5 time percentiles * 5 metrics = 25
        # + 3 economic metrics
        # + 2 military metrics
        # + 3 expansion timings
        # + 1 aggression
        # + 1 spending efficiency
        # + 10 build order features
        # + 6 composition features
        return 51

    def _find_closest_snapshot(
        self,
        snapshots: List[Dict],
        target_time: int
    ) -> Optional[Dict]:
        """Find snapshot closest to target time."""
        if not snapshots:
            return None

        closest = min(
            snapshots,
            key=lambda s: abs(s.get('game_time_seconds', 0) - target_time)
        )

        # Only return if within reasonable range
        if abs(closest.get('game_time_seconds', 0) - target_time) <= 60:
            return closest

        return None

    def _get_expansion_timing(
        self,
        snapshots: List[Dict],
        target_bases: int,
        game_length: int
    ) -> float:
        """
        Get normalized timing when player reached target base count.
        Returns 0-1 (fraction of game length), or 1.0 if never reached.
        """
        for snap in snapshots:
            if snap.get('base_count', 0) >= target_bases:
                time = snap.get('game_time_seconds', 0)
                return time / game_length if game_length > 0 else 1.0

        return 1.0  # Never reached

    def _calculate_aggression(
        self,
        snapshots: List[Dict],
        game_length: int
    ) -> float:
        """
        Calculate aggression level (0-1).
        Higher = more army investment early, Lower = more eco investment.
        """
        # Look at early-mid game (20%-60% of game)
        early_mid = [
            s for s in snapshots
            if 0.2 <= s.get('game_time_seconds', 0) / game_length <= 0.6
        ]

        if not early_mid:
            return 0.5

        # Calculate army value vs worker count ratio
        ratios = []
        for snap in early_mid:
            workers = snap.get('worker_count', 1)
            army = snap.get('army_value_minerals', 0) + snap.get('army_value_gas', 0)

            # Normalize: typical worker is ~50 minerals worth
            worker_value = workers * 50
            total_value = worker_value + army

            if total_value > 0:
                army_ratio = army / total_value
                ratios.append(army_ratio)

        return np.mean(ratios) if ratios else 0.5

    def _calculate_spending_efficiency(self, snapshots: List[Dict]) -> float:
        """
        Calculate spending efficiency (0-1).
        Lower unspent resources = higher efficiency.
        """
        if not snapshots:
            return 0.5

        # Average unspent resources as fraction of collection rate
        efficiencies = []

        for snap in snapshots:
            unspent = snap.get('unspent_resources_minerals', 0) + snap.get('unspent_resources_gas', 0)
            collection = snap.get('collection_rate_minerals', 0) + snap.get('collection_rate_gas', 0)

            if collection > 0:
                # Unspent as fraction of 1 minute of collection
                efficiency = 1.0 - min(1.0, unspent / (collection * 60))
                efficiencies.append(efficiency)

        return np.mean(efficiencies) if efficiencies else 0.5

    def _extract_build_features(
        self,
        build_events: List[Dict],
        game_length: int
    ) -> List[float]:
        """
        Extract build order timing features.
        Returns normalized timings for key buildings/units.
        """
        features = []

        # Key milestone timings (normalized by game length)
        key_items = [
            'CyberneticsCore', 'Barracks', 'SpawningPool',  # Early tech
            'Stargate', 'Factory', 'Lair',  # Mid tech
            'RoboticsFacility', 'Starport', 'Hive',  # Late tech
            'Nexus', 'CommandCenter', 'Hatchery'  # Expansions
        ]

        for item in key_items[:10]:  # Take first 10 for fixed dimension
            timing = 1.0  # Default: never built

            for event in build_events:
                if item in event.get('item_name', ''):
                    time = event.get('game_time_seconds', 0)
                    timing = time / game_length if game_length > 0 else 1.0
                    break

            features.append(timing)

        return features

    def _extract_composition_features(self, snapshots: List[Dict]) -> List[float]:
        """
        Extract unit composition features.
        Returns features about unit type distributions.
        """
        if not snapshots:
            return [0] * 6

        # Sample mid-game snapshot (50% point)
        mid_snap = snapshots[len(snapshots) // 2]

        units_str = mid_snap.get('units', '{}')
        try:
            units = json.loads(units_str) if isinstance(units_str, str) else units_str
        except (json.JSONDecodeError, TypeError) as e:
            logger.debug(f"Failed to parse units JSON: {e}")
            units = {}

        # Calculate composition diversity (entropy-like measure)
        total_units = sum(units.values()) if units else 0

        if total_units > 0:
            # Top 3 unit types by count
            sorted_units = sorted(units.items(), key=lambda x: x[1], reverse=True)
            top3_ratios = [
                count / total_units for _, count in sorted_units[:3]
            ]

            # Pad to 3 values
            while len(top3_ratios) < 3:
                top3_ratios.append(0)

            # Composition diversity (1 = all same unit, 0 = perfectly diverse)
            diversity = 1.0 - (sum(top3_ratios))

            return [
                *top3_ratios,  # Top 3 unit type ratios
                diversity,  # Overall diversity
                total_units / 100,  # Total unit count (scaled)
                len(units)  # Number of different unit types
            ]

        return [0] * 6

    def get_embedding(
        self,
        game_id: int,
        db_path: Path,
        player_number: int = 1,
        use_cache: bool = True
    ) -> np.ndarray:
        """
        Get embedding for a game. Uses cache if available.

        Args:
            game_id: Game ID
            db_path: Path to database
            player_number: Player perspective (1 or 2)
            use_cache: Whether to use cached embeddings

        Returns:
            Feature vector embedding
        """
        cache_key = (game_id, player_number)

        if use_cache and cache_key in self.embeddings_cache:
            return self.embeddings_cache[cache_key]

        # Extract features from database
        with get_connection(db_path) as conn:
            cursor = conn.cursor()

            # Get game length
            cursor.execute("SELECT game_length_seconds FROM games WHERE id = ?", (game_id,))
            result = cursor.fetchone()
            game_length = result[0] if result else 0

            # Get snapshots
            cursor.execute("""
                SELECT game_time_seconds, worker_count, army_value_minerals, army_value_gas,
                       base_count, mineral_collection_rate, gas_collection_rate,
                       unspent_minerals, unspent_gas, units
                FROM snapshots
                WHERE game_id = ? AND player_number = ?
                ORDER BY game_time_seconds
            """, (game_id, player_number))

            snapshots = []
            for row in cursor.fetchall():
                snapshots.append({
                    'game_time_seconds': row[0],
                    'worker_count': row[1],
                    'army_value_minerals': row[2],
                    'army_value_gas': row[3],
                    'base_count': row[4],
                    'collection_rate_minerals': row[5],
                    'collection_rate_gas': row[6],
                    'unspent_resources_minerals': row[7],
                    'unspent_resources_gas': row[8],
                    'units': row[9]
                })

        # Extract features
        embedding = self.extract_features(snapshots, game_length)

        # Cache it
        if use_cache:
            self.embeddings_cache[cache_key] = embedding
            self._save_cache()

        return embedding


def find_similar_games_ml(
    db_path: Path,
    user_game_id: int,
    limit: int = 5,
    player_perspective: int = 1,
    embedder: Optional[GameEmbedder] = None
) -> List[Dict[str, Any]]:
    """
    Find similar games using ML embeddings.

    Args:
        db_path: Path to database
        user_game_id: User's game ID
        limit: Number of similar games to return
        player_perspective: Which player to analyze (1 or 2)
        embedder: Optional GameEmbedder instance (will create if None)

    Returns:
        List of similar games with similarity scores
    """
    if embedder is None:
        cache_path = db_path.parent / '.embeddings_cache.json'
        embedder = GameEmbedder(cache_path=cache_path)

    with get_connection(db_path) as conn:
        cursor = conn.cursor()

        # Get user game metadata
        cursor.execute("""
            SELECT game_length_seconds, map_name, player1_race, player2_race
            FROM games
            WHERE id = ?
        """, (user_game_id,))

        user_game = cursor.fetchone()
        if not user_game:
            return []

        user_length, user_map, user_p1_race, user_p2_race = user_game

        # Get user game embedding
        user_embedding = embedder.get_embedding(user_game_id, db_path, player_perspective)

        # Find pro games with exact matchup
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

    # Calculate embeddings and similarities for all pro games
    similarities = []
    pro_embeddings = []

    for pro_game in pro_games:
        pro_id, pro_length, pro_map, pro_p1_race, pro_p2_race, pro_p1_name, pro_p2_name, pro_date = pro_game

        # Determine player perspective in pro game
        if pro_p1_race == user_p1_race and pro_p2_race == user_p2_race:
            pro_player_num = player_perspective
        elif pro_p1_race == user_p2_race and pro_p2_race == user_p1_race:
            pro_player_num = 2 if player_perspective == 1 else 1
        else:
            continue

        # Get pro game embedding
        pro_embedding = embedder.get_embedding(pro_id, db_path, pro_player_num)
        pro_embeddings.append(pro_embedding)

        # Calculate cosine similarity
        similarity = cosine_similarity(
            user_embedding.reshape(1, -1),
            pro_embedding.reshape(1, -1)
        )[0][0]

        # Convert to 0-100 percentage
        similarity_pct = (similarity + 1) / 2 * 100  # Cosine is -1 to 1, convert to 0-100

        # Map bonus
        map_bonus = 2.0 if user_map and pro_map and user_map == pro_map else 0.0

        # Length penalty (prefer similar length games)
        length_diff = abs(user_length - pro_length)
        length_penalty = min(5.0, length_diff / 120)  # -5% for every 2 minutes difference

        final_score = min(100, similarity_pct + map_bonus - length_penalty)

        matched_player_name = pro_p1_name if pro_player_num == 1 else pro_p2_name
        matched_player_race = pro_p1_race if pro_player_num == 1 else pro_p2_race

        similarities.append({
            "game_id": int(pro_id),
            "similarity_score": float(final_score / 100),  # Normalize to 0-1 for consistency
            "ml_similarity": float(similarity_pct),
            "game_length_seconds": int(pro_length),
            "map_name": pro_map,
            "player1_name": pro_p1_name,
            "player2_name": pro_p2_name,
            "player1_race": pro_p1_race,
            "player2_race": pro_p2_race,
            "game_date": pro_date,
            "matched_player_number": int(pro_player_num),
            "matched_player_name": matched_player_name,
            "matched_player_race": matched_player_race,
            "matchup": f"{user_p1_race[0]}v{user_p2_race[0]}"
        })

    # Sort by similarity and return top N
    similarities.sort(key=lambda x: x["similarity_score"], reverse=True)

    return similarities[:limit]

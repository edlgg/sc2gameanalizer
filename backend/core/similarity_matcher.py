import json
from typing import Dict, List, Tuple

class SimilarityMatcher:
    """Calculate similarity between build signatures."""

    def calculate_similarity(self, user_sig_json: str, pro_sig_json: str) -> float:
        """
        Calculate similarity score between two build signatures.
        Lower score = more similar.

        Args:
            user_sig_json: User's build signature (JSON string)
            pro_sig_json: Pro's build signature (JSON string)

        Returns:
            Similarity score (lower is more similar)
        """
        user_sig = json.loads(user_sig_json)
        pro_sig = json.loads(pro_sig_json)

        # Get all unique building/unit types
        all_types = set(user_sig.keys()) | set(pro_sig.keys())

        total_score = 0.0

        for build_type in all_types:
            user_times = user_sig.get(build_type, [])
            pro_times = pro_sig.get(build_type, [])

            # Penalty for missing/extra buildings
            if len(user_times) == 0 or len(pro_times) == 0:
                total_score += 100.0  # Large penalty for completely different tech
                continue

            # Compare timing differences for each occurrence
            # Match user events to closest pro events
            for i, user_time in enumerate(user_times):
                # Weight earlier events more heavily
                weight = 2.0 if i < 3 else 1.0

                if i < len(pro_times):
                    # Compare against corresponding pro event
                    time_diff = abs(user_time - pro_times[i])
                    total_score += time_diff * weight
                else:
                    # User built more than pro - small penalty
                    total_score += 30.0 * weight

            # Penalty if pro built more than user
            if len(pro_times) > len(user_times):
                total_score += 50.0 * (len(pro_times) - len(user_times))

        return total_score

    def find_similar_games(
        self,
        user_sig_json: str,
        pro_signatures: List[Tuple[int, str]],
        top_n: int = 5
    ) -> List[Tuple[int, float]]:
        """
        Find top N most similar pro games.

        Args:
            user_sig_json: User's build signature
            pro_signatures: List of (pro_game_id, signature_json) tuples
            top_n: Number of top matches to return

        Returns:
            List of (pro_game_id, similarity_score) tuples, sorted by score (ascending)
        """
        scores = []

        for pro_game_id, pro_sig_json in pro_signatures:
            score = self.calculate_similarity(user_sig_json, pro_sig_json)
            scores.append((pro_game_id, score))

        # Sort by score (lower is better)
        scores.sort(key=lambda x: x[1])

        return scores[:top_n]

from typing import List, Dict, Any

class GapAnalyzer:
    """Analyze gaps between user and pro game performance."""

    KEY_TIMESTAMPS = [240, 360, 480, 600]  # 4min, 6min, 8min, 10min

    def detect_economic_gaps(
        self,
        user_snapshots: List[Dict[str, Any]],
        pro_snapshots: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Detect economic gaps (workers, income, bases).

        Args:
            user_snapshots: User's game snapshots
            pro_snapshots: Pro average snapshots

        Returns:
            List of gap dictionaries
        """
        gaps = []

        # Create lookup by timestamp
        user_by_time = {s["game_time"]: s for s in user_snapshots}
        pro_by_time = {s["game_time"]: s for s in pro_snapshots}

        # Check key timestamps
        for timestamp in self.KEY_TIMESTAMPS:
            if timestamp not in user_by_time or timestamp not in pro_by_time:
                continue

            user_snap = user_by_time[timestamp]
            pro_snap = pro_by_time[timestamp]

            # Worker count gap
            worker_diff = user_snap["worker_count"] - pro_snap["worker_count"]
            if abs(worker_diff) >= 5:  # Significant gap threshold
                gaps.append({
                    "metric": "worker_count",
                    "timestamp": timestamp,
                    "user_value": user_snap["worker_count"],
                    "pro_value": pro_snap["worker_count"],
                    "difference": worker_diff,
                    "severity": "high" if abs(worker_diff) >= 10 else "medium"
                })

            # Base count gap
            if "bases_count" in user_snap and "bases_count" in pro_snap:
                base_diff = user_snap["bases_count"] - pro_snap["bases_count"]
                if base_diff < 0:  # User has fewer bases
                    gaps.append({
                        "metric": "bases_count",
                        "timestamp": timestamp,
                        "user_value": user_snap["bases_count"],
                        "pro_value": pro_snap["bases_count"],
                        "difference": base_diff,
                        "severity": "high" if base_diff <= -2 else "medium"
                    })

            # Unspent resources (too much bank)
            if "unspent_resources" in user_snap and "unspent_resources" in pro_snap:
                if user_snap["unspent_resources"] > pro_snap["unspent_resources"] + 1000:
                    gaps.append({
                        "metric": "unspent_resources",
                        "timestamp": timestamp,
                        "user_value": user_snap["unspent_resources"],
                        "pro_value": pro_snap["unspent_resources"],
                        "difference": user_snap["unspent_resources"] - pro_snap["unspent_resources"],
                        "severity": "medium"
                    })

        return gaps

    def detect_army_gaps(
        self,
        user_snapshots: List[Dict[str, Any]],
        pro_snapshots: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Detect army composition and value gaps.

        Args:
            user_snapshots: User's game snapshots
            pro_snapshots: Pro average snapshots

        Returns:
            List of gap dictionaries
        """
        gaps = []

        user_by_time = {s["game_time"]: s for s in user_snapshots}
        pro_by_time = {s["game_time"]: s for s in pro_snapshots}

        for timestamp in self.KEY_TIMESTAMPS:
            if timestamp not in user_by_time or timestamp not in pro_by_time:
                continue

            user_snap = user_by_time[timestamp]
            pro_snap = pro_by_time[timestamp]

            # Army value gap
            army_diff = user_snap["army_value"] - pro_snap["army_value"]
            if army_diff < -1000:  # User army significantly smaller
                gaps.append({
                    "metric": "army_value",
                    "timestamp": timestamp,
                    "user_value": user_snap["army_value"],
                    "pro_value": pro_snap["army_value"],
                    "difference": army_diff,
                    "severity": "high" if army_diff < -2000 else "medium"
                })

        return gaps

    def generate_recommendations(self, gaps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Generate actionable recommendations from detected gaps.

        Args:
            gaps: List of gap dictionaries

        Returns:
            List of recommendation dictionaries with text and priority
        """
        recommendations = []

        # Sort gaps by severity and magnitude
        sorted_gaps = sorted(
            gaps,
            key=lambda g: (
                0 if g["severity"] == "high" else 1,
                -abs(g.get("difference", 0))  # Negative for descending order
            )
        )

        for gap in sorted_gaps[:5]:  # Top 5 gaps
            rec = self._gap_to_recommendation(gap)
            if rec:
                recommendations.append(rec)

        return recommendations

    def _gap_to_recommendation(self, gap: Dict[str, Any]) -> Dict[str, Any]:
        """Convert a gap into a recommendation."""
        metric = gap["metric"]
        timestamp = gap["timestamp"]
        diff = gap.get("difference", 0)

        minutes = timestamp // 60
        seconds = timestamp % 60
        time_str = f"{minutes}:{seconds:02d}"

        if metric == "worker_count":
            text = f"Build {abs(diff)} more workers by {time_str} (you had {gap['user_value']}, pros average {gap['pro_value']})"
        elif metric == "bases_count":
            text = f"Take your {gap['pro_value']}{'st' if gap['pro_value'] == 1 else 'nd' if gap['pro_value'] == 2 else 'rd' if gap['pro_value'] == 3 else 'th'} base by {time_str}"
        elif metric == "army_value":
            text = f"Your army was {abs(diff)} resources behind at {time_str} (had {gap['user_value']}, pros average {gap['pro_value']})"
        elif metric == "unspent_resources":
            text = f"You had {diff} unspent resources at {time_str} - spend your money!"
        else:
            return None

        return {
            "metric": metric,
            "timestamp": timestamp,
            "text": text,
            "priority": gap["severity"]
        }

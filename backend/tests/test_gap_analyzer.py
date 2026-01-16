import pytest
from core.gap_analyzer import GapAnalyzer

def test_detect_worker_gap():
    user_snapshots = [
        {"game_time": 0, "worker_count": 12},
        {"game_time": 300, "worker_count": 40},
        {"game_time": 360, "worker_count": 45},
    ]

    pro_snapshots = [
        {"game_time": 0, "worker_count": 12},
        {"game_time": 300, "worker_count": 50},
        {"game_time": 360, "worker_count": 58},
    ]

    analyzer = GapAnalyzer()
    gaps = analyzer.detect_economic_gaps(user_snapshots, pro_snapshots)

    assert len(gaps) > 0
    worker_gaps = [g for g in gaps if g["metric"] == "worker_count"]
    assert len(worker_gaps) > 0

    # Should detect gap at 6min (360s)
    gap_at_6min = next((g for g in worker_gaps if g["timestamp"] == 360), None)
    assert gap_at_6min is not None
    assert gap_at_6min["user_value"] == 45
    assert gap_at_6min["pro_value"] == 58
    assert gap_at_6min["difference"] == -13

def test_detect_army_gap():
    user_snapshots = [
        {"game_time": 480, "army_value": 2000, "army_supply": 40},
        {"game_time": 600, "army_value": 2500, "army_supply": 50},
    ]

    pro_snapshots = [
        {"game_time": 480, "army_value": 3500, "army_supply": 70},
        {"game_time": 600, "army_value": 4000, "army_supply": 80},
    ]

    analyzer = GapAnalyzer()
    gaps = analyzer.detect_army_gaps(user_snapshots, pro_snapshots)

    assert len(gaps) > 0

    gap = gaps[0]
    assert gap["metric"] in ["army_value", "army_supply"]
    assert gap["user_value"] < gap["pro_value"]

def test_generate_recommendations():
    gaps = [
        {
            "metric": "worker_count",
            "timestamp": 360,
            "user_value": 45,
            "pro_value": 58,
            "difference": -13,
            "severity": "high"
        },
        {
            "metric": "bases_count",
            "timestamp": 480,
            "user_value": 2,
            "pro_value": 3,
            "difference": -1,
            "severity": "medium"
        }
    ]

    analyzer = GapAnalyzer()
    recommendations = analyzer.generate_recommendations(gaps)

    assert len(recommendations) > 0
    assert "worker" in recommendations[0]["text"].lower()
    assert recommendations[0]["priority"] in ["high", "medium", "low"]

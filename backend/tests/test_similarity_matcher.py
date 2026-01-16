import pytest
import json
from core.similarity_matcher import SimilarityMatcher

def test_calculate_similarity_score():
    user_sig = {
        "Gateway": [125, 150],
        "CyberneticsCore": [155],
        "Stalker": [185, 200]
    }

    pro_sig = {
        "Gateway": [120, 145],
        "CyberneticsCore": [150],
        "Stalker": [180, 195]
    }

    matcher = SimilarityMatcher()
    score = matcher.calculate_similarity(
        json.dumps(user_sig),
        json.dumps(pro_sig)
    )

    # Score should be low (similar builds)
    assert score >= 0
    assert score < 100  # Somewhat similar

def test_different_builds_high_score():
    user_sig = {
        "Gateway": [120],
        "CyberneticsCore": [150],
    }

    pro_sig = {
        "Gateway": [120, 140, 160],  # 3 gates vs 1
        "RoboticsFacility": [180],  # Different tech
    }

    matcher = SimilarityMatcher()
    score = matcher.calculate_similarity(
        json.dumps(user_sig),
        json.dumps(pro_sig)
    )

    # Score should be high (different builds)
    assert score > 100

def test_find_similar_games():
    user_sig = {"Gateway": [120], "CyberneticsCore": [150]}

    pro_sigs = [
        (1, json.dumps({"Gateway": [115], "CyberneticsCore": [145]})),  # Very similar
        (2, json.dumps({"Gateway": [200], "CyberneticsCore": [230]})),  # Late build
        (3, json.dumps({"Gateway": [120, 140], "Stargate": [180]})),  # Different tech
        (4, json.dumps({"Gateway": [118], "CyberneticsCore": [148]})),  # Very similar
    ]

    matcher = SimilarityMatcher()
    results = matcher.find_similar_games(json.dumps(user_sig), pro_sigs, top_n=2)

    assert len(results) == 2
    assert results[0][0] in [1, 4]  # Most similar should be game 1 or 4
    assert results[0][1] < results[1][1]  # First result should have lower score

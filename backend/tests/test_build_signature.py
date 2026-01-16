import pytest
import json
from core.build_signature import BuildSignatureGenerator

def test_generate_signature_from_events():
    events = [
        {"game_time": 12, "event_type": "unit", "name": "Probe"},
        {"game_time": 24, "event_type": "building", "name": "Gateway"},
        {"game_time": 35, "event_type": "building", "name": "Gateway"},
        {"game_time": 40, "event_type": "building", "name": "CyberneticsCore"},
        {"game_time": 60, "event_type": "unit", "name": "Stalker"},
        {"game_time": 75, "event_type": "unit", "name": "Stalker"},
        {"game_time": 500, "event_type": "unit", "name": "Stalker"},  # After 8min
    ]

    generator = BuildSignatureGenerator()
    signature = generator.generate_signature(events, max_time=480)  # 8 minutes

    sig_dict = json.loads(signature)

    assert "Gateway" in sig_dict
    assert sig_dict["Gateway"] == [24, 35]  # Both gateways
    assert "CyberneticsCore" in sig_dict
    assert sig_dict["CyberneticsCore"] == [40]
    assert "Stalker" in sig_dict
    assert sig_dict["Stalker"] == [60, 75]  # Only first 2, not the one at 500s

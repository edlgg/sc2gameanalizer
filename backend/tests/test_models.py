"""
Tests for SQLAlchemy database models.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from db.base import Base
from models.game import Game
from models.build_event import BuildEvent
from models.snapshot import Snapshot
from models.pro_game import ProGame


@pytest.fixture
def db_session():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_game_model_creation(db_session):
    """Test creating and querying a Game model."""
    game = Game(
        player_name="TestPlayer",
        player_race="Terran",
        opponent_name="OpponentPlayer",
        opponent_race="Zerg",
        matchup="TvZ",
        map_name="Altitude LE",
        game_length=1234,
        result="Win",
        game_date="2024-01-15",
        is_pro_game=False
    )

    db_session.add(game)
    db_session.commit()

    # Query the game back
    queried_game = db_session.query(Game).filter_by(player_name="TestPlayer").first()

    assert queried_game is not None
    assert queried_game.player_name == "TestPlayer"
    assert queried_game.player_race == "Terran"
    assert queried_game.opponent_name == "OpponentPlayer"
    assert queried_game.opponent_race == "Zerg"
    assert queried_game.matchup == "TvZ"
    assert queried_game.map_name == "Altitude LE"
    assert queried_game.game_length == 1234
    assert queried_game.result == "Win"
    assert queried_game.game_date == "2024-01-15"
    assert queried_game.is_pro_game == False


def test_build_event_model(db_session):
    """Test creating and querying a BuildEvent model with a Game relationship."""
    # Create a game first
    game = Game(
        player_name="TestPlayer",
        player_race="Protoss",
        opponent_name="Opponent",
        opponent_race="Terran",
        matchup="PvT",
        map_name="Test Map",
        game_length=1000,
        result="Win",
        game_date="2024-01-15"
    )
    db_session.add(game)
    db_session.commit()

    # Create build events
    event1 = BuildEvent(
        game_id=game.id,
        supply_used=12,
        game_time=20,
        event_type="unit",
        name="Probe",
        count=1,
        resources_spent=50
    )
    event2 = BuildEvent(
        game_id=game.id,
        supply_used=14,
        game_time=35,
        event_type="building",
        name="Pylon",
        count=1,
        resources_spent=100
    )

    db_session.add_all([event1, event2])
    db_session.commit()

    # Query events back
    queried_events = db_session.query(BuildEvent).filter_by(game_id=game.id).order_by(BuildEvent.game_time).all()

    assert len(queried_events) == 2
    assert queried_events[0].supply_used == 12
    assert queried_events[0].game_time == 20
    assert queried_events[0].event_type == "unit"
    assert queried_events[0].name == "Probe"
    assert queried_events[1].supply_used == 14
    assert queried_events[1].game_time == 35
    assert queried_events[1].event_type == "building"
    assert queried_events[1].name == "Pylon"


def test_snapshot_model(db_session):
    """Test creating and querying a Snapshot model with Game relationship."""
    # Create a game first
    game = Game(
        player_name="SnapshotPlayer",
        player_race="Zerg",
        opponent_name="SnapshotOpponent",
        opponent_race="Protoss",
        matchup="ZvP",
        map_name="Snapshot Map",
        game_length=1500,
        result="Loss",
        game_date="2024-01-16"
    )
    db_session.add(game)
    db_session.commit()

    # Create snapshots at different game times
    snapshot1 = Snapshot(
        game_id=game.id,
        game_time=60,
        worker_count=16,
        army_supply=22,
        army_value=200,
        mineral_collection_rate=1000,
        gas_collection_rate=200,
        unspent_resources=50,
        bases_count=2,
        upgrade_progress=10
    )
    snapshot2 = Snapshot(
        game_id=game.id,
        game_time=120,
        worker_count=22,
        army_supply=35,
        army_value=800,
        mineral_collection_rate=1500,
        gas_collection_rate=400,
        unspent_resources=100,
        bases_count=3,
        upgrade_progress=30
    )

    db_session.add_all([snapshot1, snapshot2])
    db_session.commit()

    # Query snapshots back
    queried_snapshots = db_session.query(Snapshot).filter_by(game_id=game.id).order_by(Snapshot.game_time).all()

    assert len(queried_snapshots) == 2
    assert queried_snapshots[0].game_time == 60
    assert queried_snapshots[0].worker_count == 16
    assert queried_snapshots[0].army_supply == 22
    assert queried_snapshots[0].army_value == 200
    assert queried_snapshots[0].mineral_collection_rate == 1000
    assert queried_snapshots[0].unspent_resources == 50
    assert queried_snapshots[1].game_time == 120
    assert queried_snapshots[1].worker_count == 22


def test_pro_game_model(db_session):
    """Test creating and querying a ProGame model."""
    # Create a game first (ProGame requires a game_id)
    game = Game(
        player_name="Maru",
        player_race="Terran",
        opponent_name="Rogue",
        opponent_race="Zerg",
        matchup="TvZ",
        map_name="Pro Map",
        game_length=1800,
        result="Win",
        game_date="2024-01-20",
        is_pro_game=True
    )
    db_session.add(game)
    db_session.commit()

    pro_game = ProGame(
        game_id=game.id,
        matchup="TvZ",
        build_signature="14CC,15Rax,16Rax,Factory,Starport",
        player_name="Maru",
        opponent_name="Rogue",
        patch_version="5.0.12",
        build_label="Standard Macro",
        avg_worker_at_6min=45,
        avg_army_value_at_8min=3000
    )

    db_session.add(pro_game)
    db_session.commit()

    # Query the pro game back
    queried_pro_game = db_session.query(ProGame).filter_by(player_name="Maru").first()

    assert queried_pro_game is not None
    assert queried_pro_game.matchup == "TvZ"
    assert queried_pro_game.build_signature == "14CC,15Rax,16Rax,Factory,Starport"
    assert queried_pro_game.player_name == "Maru"
    assert queried_pro_game.opponent_name == "Rogue"
    assert queried_pro_game.patch_version == "5.0.12"
    assert queried_pro_game.build_label == "Standard Macro"

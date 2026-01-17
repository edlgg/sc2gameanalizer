"""Database models and writer for SQLAlchemy."""

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import sessionmaker, relationship, DeclarativeBase
from datetime import datetime
import json


class Base(DeclarativeBase):
    """Declarative base for all models."""
    pass


class Game(Base):
    """Game metadata table."""
    __tablename__ = 'games'

    id = Column(Integer, primary_key=True)
    replay_file_path = Column(String, unique=True, nullable=False)
    map_name = Column(String)
    game_length_seconds = Column(Integer)
    game_date = Column(DateTime)
    player1_name = Column(String)
    player1_race = Column(String)
    player2_name = Column(String)
    player2_race = Column(String)
    winner = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

    snapshots = relationship("Snapshot", back_populates="game", cascade="all, delete-orphan")


class Snapshot(Base):
    """Time-series snapshot table."""
    __tablename__ = 'snapshots'

    id = Column(Integer, primary_key=True)
    game_id = Column(Integer, ForeignKey('games.id', ondelete='CASCADE'), nullable=False)
    game_time_seconds = Column(Integer, nullable=False)

    # Player 1 Economy
    p1_workers = Column(Integer)
    p1_minerals = Column(Integer)
    p1_vespene = Column(Integer)
    p1_mineral_collection_rate = Column(Float)
    p1_vespene_collection_rate = Column(Float)

    # Player 1 Army
    p1_army_supply = Column(Integer)
    p1_army_value = Column(Integer)
    p1_unit_counts = Column(Text)  # JSON

    # Player 1 Tech
    p1_completed_buildings = Column(Text)  # JSON
    p1_in_progress_buildings = Column(Text)  # JSON
    p1_completed_upgrades = Column(Text)  # JSON
    p1_in_progress_upgrades = Column(Text)  # JSON

    # Player 1 Map Control
    p1_bases = Column(Integer)
    p1_map_presence = Column(Float)

    # Player 2 (mirror structure)
    p2_workers = Column(Integer)
    p2_minerals = Column(Integer)
    p2_vespene = Column(Integer)
    p2_mineral_collection_rate = Column(Float)
    p2_vespene_collection_rate = Column(Float)

    p2_army_supply = Column(Integer)
    p2_army_value = Column(Integer)
    p2_unit_counts = Column(Text)

    p2_completed_buildings = Column(Text)
    p2_in_progress_buildings = Column(Text)
    p2_completed_upgrades = Column(Text)
    p2_in_progress_upgrades = Column(Text)

    p2_bases = Column(Integer)
    p2_map_presence = Column(Float)

    game = relationship("Game", back_populates="snapshots")


class ParseError(Base):
    """Parse error tracking table."""
    __tablename__ = 'parse_errors'

    id = Column(Integer, primary_key=True)
    replay_file_path = Column(String, nullable=False)
    error_message = Column(Text)
    error_timestamp = Column(DateTime, default=datetime.utcnow)


# Database functions
def init_database(db_path: str):
    """Initialize database schema."""
    engine = create_engine(f'sqlite:///{db_path}')
    Base.metadata.create_all(engine)
    print(f"Database initialized at {db_path}")
    return engine


def get_session(db_path: str):
    """Get database session."""
    engine = create_engine(f'sqlite:///{db_path}')
    Session = sessionmaker(bind=engine)
    return Session()


def create_game(session, metadata: dict, snapshots: list) -> bool:
    """Persist game and snapshots to database."""
    # Implementation in Step 7
    pass


# CLI interface for database initialization
if __name__ == "__main__":
    import sys

    if len(sys.argv) >= 2 and sys.argv[1] == "init":
        db_path = sys.argv[2] if len(sys.argv) > 2 else "data/output.db"
        init_database(db_path)
    else:
        print("Usage: python -m src.database init [db_path]")

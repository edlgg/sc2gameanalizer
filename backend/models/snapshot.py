"""
Snapshot model - represents 5-second game state snapshots.
"""
from sqlalchemy import Column, Integer, Float, ForeignKey
from sqlalchemy.orm import relationship
from db.base import Base


class Snapshot(Base):
    """Represents a 5-second snapshot of game state."""

    __tablename__ = "snapshots"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True)
    game_time = Column(Integer, nullable=False, index=True)  # in seconds
    worker_count = Column(Integer, nullable=False)
    army_supply = Column(Integer, nullable=False)
    army_value = Column(Integer, nullable=False)  # resource value of army
    mineral_collection_rate = Column(Integer, nullable=False)  # minerals per minute
    gas_collection_rate = Column(Integer, nullable=False)  # gas per minute
    unspent_resources = Column(Integer, nullable=False)
    bases_count = Column(Integer, nullable=False)
    upgrade_progress = Column(Integer, default=0)  # percentage of upgrades completed

    # Relationship to Game
    game = relationship("Game", backref="snapshots")

    def __repr__(self):
        return f"<Snapshot(id={self.id}, game_time={self.game_time}, army_supply={self.army_supply})>"

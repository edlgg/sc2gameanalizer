"""
BuildEvent model - represents individual build order events.
"""
from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from db.base import Base


class BuildEvent(Base):
    """Represents a single build order event (unit, building, or upgrade)."""

    __tablename__ = "build_events"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), nullable=False, index=True)
    supply_used = Column(Integer, nullable=False)
    game_time = Column(Integer, nullable=False)  # in seconds
    event_type = Column(String, nullable=False)  # "unit", "building", "upgrade"
    name = Column(String, nullable=False, index=True)  # e.g., "Marine", "Barracks", "Stim"
    count = Column(Integer, default=1)
    resources_spent = Column(Integer)
    location_x = Column(Float, nullable=True)
    location_y = Column(Float, nullable=True)

    # Relationship to Game
    game = relationship("Game", backref="build_events")

    def __repr__(self):
        return f"<BuildEvent(id={self.id}, name={self.name}, time={self.game_time})>"

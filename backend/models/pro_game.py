"""
ProGame model - represents pre-computed pro game build order signatures.
"""
from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey
from sqlalchemy.orm import relationship
from db.base import Base


class ProGame(Base):
    """Represents a professional game with build order signature."""

    __tablename__ = "pro_games"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), nullable=False, unique=True)
    matchup = Column(String, index=True, nullable=False)
    build_signature = Column(Text, nullable=False)
    player_name = Column(String, nullable=False)
    opponent_name = Column(String, nullable=False)
    patch_version = Column(String)
    build_label = Column(String, nullable=True)  # e.g., "Proxy Reaper", "Standard Macro"
    avg_worker_at_6min = Column(Integer)
    avg_army_value_at_8min = Column(Integer)

    # Relationship to Game
    game = relationship("Game", backref="pro_game", uselist=False)

    def __repr__(self):
        return f"<ProGame(id={self.id}, player={self.player_name}, matchup={self.matchup})>"

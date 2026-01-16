"""
Game model - represents a single analyzed SC2 game.
"""
from sqlalchemy import Column, Integer, String, Boolean
from db.base import Base


class Game(Base):
    """Represents a single analyzed SC2 game."""

    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    player_name = Column(String, nullable=False)
    player_race = Column(String, nullable=False)
    opponent_name = Column(String, nullable=False)
    opponent_race = Column(String, nullable=False)
    matchup = Column(String, index=True, nullable=False)  # e.g., "TvZ"
    map_name = Column(String, nullable=False)
    game_length = Column(Integer, nullable=False)  # in seconds
    result = Column(String, nullable=False)  # "Win" or "Loss"
    game_date = Column(String)  # ISO format date
    is_pro_game = Column(Boolean, default=False, index=True)

    def __repr__(self):
        return f"<Game(id={self.id}, matchup={self.matchup}, result={self.result})>"

from pydantic import BaseModel
from typing import List, Optional

class GameMetadata(BaseModel):
    player_name: str
    player_race: str
    opponent_name: str
    opponent_race: str
    matchup: str
    game_length: int
    map_name: Optional[str] = None
    game_date: Optional[str] = None
    result: Optional[str] = None

class BuildEvent(BaseModel):
    game_time: int
    event_type: str
    name: str
    count: int = 1

class Snapshot(BaseModel):
    game_time: int
    worker_count: int
    army_value: int
    army_supply: int
    bases_count: int

class Gap(BaseModel):
    metric: str
    timestamp: int
    user_value: float
    pro_value: float
    difference: float
    severity: str

class Recommendation(BaseModel):
    metric: str
    timestamp: int
    text: str
    priority: str

class AnalysisResult(BaseModel):
    game_metadata: GameMetadata
    similar_pro_games: List[int]
    gaps: List[Gap]
    recommendations: List[Recommendation]
    user_snapshots: List[Snapshot]
    pro_snapshots: List[Snapshot]

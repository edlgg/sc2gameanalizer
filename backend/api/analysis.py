from fastapi import APIRouter, UploadFile, File, HTTPException
from schemas.game import AnalysisResult, GameMetadata
from core.replay_parser import ReplayParser
from core.build_signature import BuildSignatureGenerator
from core.similarity_matcher import SimilarityMatcher
from core.gap_analyzer import GapAnalyzer
import tempfile
import os

router = APIRouter()

@router.post("/analyze", response_model=AnalysisResult)
async def analyze_replay(replay: UploadFile = File(...)):
    """
    Analyze a single replay file.

    Upload a .SC2Replay file and receive analysis comparing to pro games.
    """
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=".SC2Replay") as tmp_file:
        content = await replay.read()
        tmp_file.write(content)
        tmp_path = tmp_file.name

    try:
        # Parse replay
        parser = ReplayParser()
        replay_obj = parser.load_replay(tmp_path)

        # Extract data
        metadata = parser.extract_game_metadata(replay_obj)
        events = parser.extract_build_events(replay_obj, player_index=0)
        snapshots = parser.extract_snapshots(replay_obj, player_index=0)

        # Generate build signature
        sig_gen = BuildSignatureGenerator()
        user_signature = sig_gen.generate_signature(events, max_time=480)

        # Find similar pro games (placeholder - need database)
        # For now, return mock data
        similar_pro_games = [1, 2, 3, 4, 5]

        # Mock pro snapshots (would come from database)
        pro_snapshots = [
            {
                "game_time": s["game_time"],
                "worker_count": s["worker_count"] + 10,
                "army_value": s["army_value"] + 500,
                "army_supply": s["army_supply"] + 5,
                "bases_count": s["bases_count"]
            }
            for s in snapshots[::12]  # Every minute
        ]

        # Analyze gaps
        analyzer = GapAnalyzer()
        gaps = analyzer.detect_economic_gaps(snapshots, pro_snapshots)
        gaps.extend(analyzer.detect_army_gaps(snapshots, pro_snapshots))
        recommendations = analyzer.generate_recommendations(gaps)

        return AnalysisResult(
            game_metadata=GameMetadata(**metadata),
            similar_pro_games=similar_pro_games,
            gaps=gaps,
            recommendations=recommendations,
            user_snapshots=[s for s in snapshots[::12]],  # Every minute for display
            pro_snapshots=pro_snapshots
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

@router.get("/pro-games")
async def list_pro_games():
    """List available pro games in database."""
    # Placeholder - would query database
    return {"pro_games": [], "count": 0}

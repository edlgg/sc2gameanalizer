#!/bin/bash
# Start the FastAPI backend server

echo "🚀 Starting SC2 Replay Analyzer Backend..."
echo "API will be available at: http://localhost:8000"
echo "API docs available at: http://localhost:8000/docs"
echo ""

# Initialize database if it doesn't exist
if [ ! -f "data/replays.db" ]; then
    echo "📊 Initializing database..."
    uv run python -c "from src.database import init_database; from pathlib import Path; init_database(Path('data/replays.db'))"
    echo "✅ Database initialized"
    echo ""
fi

# Start server
uv run uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

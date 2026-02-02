#!/bin/bash
# Start the FastAPI backend server

echo "🚀 Starting SC2 Replay Analyzer Backend..."
echo "API will be available at: http://localhost:8000"
echo "API docs available at: http://localhost:8000/docs"
echo ""

# Initialize database if it doesn't exist
if [ ! -f "../data/replays.db" ]; then
    echo "📊 Initializing database..."
    cd .. && uv run python -c "from backend.src.database import init_database; from pathlib import Path; init_database(Path('data/replays.db'))" && cd backend
    echo "✅ Database initialized"
    echo ""
fi

# Start server (must run from project root for imports to work)
cd .. && uv run uvicorn backend.api.main:app --reload --host 0.0.0.0 --port 8000

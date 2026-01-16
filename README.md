# SC2 Replay Analyzer

AI-powered StarCraft II build order analysis tool that compares your replays against professional games to identify improvement opportunities.

## Features

- Upload and analyze your SC2 replay files
- Compare your build orders against a database of professional games
- Get detailed gap analysis showing timing differences
- Visualize your macro performance with interactive charts
- Track your improvement over time

## Architecture

- **Backend**: Python/FastAPI with SQLAlchemy ORM
- **Frontend**: React/TypeScript with TailwindCSS
- **Desktop**: Electron wrapper for native experience
- **Database**: SQLite for simplicity and portability

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- SC2 replay files (.SC2Replay)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/sc2gameanalizer.git
cd sc2gameanalizer
```

2. Install backend dependencies:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. Install frontend dependencies:
```bash
cd ../frontend
npm install
```

### Running the Application

1. Start the backend server:
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

2. Start the frontend development server:
```bash
cd frontend
npm run dev
```

3. Open your browser to http://localhost:5173

## Generating Pro Database

Before you can analyze your replays, you need to generate a database of professional games:

### Step 1: Download Pro Replays

Download professional replays from sources like:
- [spawningtool.com](https://spawningtool.com) - Large collection of pro replays
- [sc2replaystats.com](https://sc2replaystats.com) - Community replay database
- Twitch VOD replays from professional streamers
- GSL/ESL tournament replays

### Step 2: Organize Replays

Place all downloaded `.SC2Replay` files in the `data/replays/` directory:

```bash
mkdir -p data/replays
# Copy your .SC2Replay files here
```

### Step 3: Generate Database

Run the generation script:

```bash
cd backend
source venv/bin/activate
python -m core.generate_pro_database
```

This will:
- Process all replays in `data/replays/`
- Extract game metadata, build events, and snapshots
- Generate build order signatures for similarity matching
- Create `data/pro_games.db` with all processed games

Example output:
```
Found 150 replay files

[1/150] Processing GSL_Maru_vs_Dark.SC2Replay...
  ✓ Game ID 1 - Maru vs Dark (TvZ)

[2/150] Processing IEM_Serral_vs_Reynor.SC2Replay...
  ✓ Game ID 2 - Serral vs Reynor (ZvZ)

...

============================================================
Processing complete!
  Successful: 148
  Failed: 2
  Database: data/pro_games.db
============================================================
```

### Step 4: Verify Database

Check that the database was created successfully:

```bash
sqlite3 data/pro_games.db "SELECT COUNT(*) FROM games WHERE is_pro_game = 1;"
```

## Usage

1. **Upload Replay**: Click "Upload Replay" and select your .SC2Replay file
2. **View Analysis**: The system will automatically:
   - Extract your build order
   - Find similar professional games
   - Identify timing gaps and differences
   - Generate improvement suggestions
3. **Explore Results**: View detailed breakdowns of:
   - Build order comparison
   - Macro snapshots
   - Gap analysis
   - Similar pro games

## Development

### Running Tests

Backend tests:
```bash
cd backend
pytest
```

Frontend tests:
```bash
cd frontend
npm test
```

E2E tests:
```bash
cd tests/e2e
npm test
```

### Code Coverage

Generate coverage report:
```bash
cd backend
pytest --cov=. --cov-report=html
```

## Project Structure

```
sc2gameanalizer/
├── backend/           # Python/FastAPI backend
│   ├── api/          # API endpoints
│   ├── core/         # Core processing logic
│   ├── db/           # Database configuration
│   ├── models/       # SQLAlchemy models
│   ├── schemas/      # Pydantic schemas
│   └── tests/        # Backend tests
├── frontend/         # React/TypeScript frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   └── services/    # API services
│   └── tests/           # Frontend tests
├── desktop/          # Electron desktop app
├── data/            # Data directory
│   ├── replays/     # Pro replays (not in git)
│   └── *.db         # SQLite databases
├── docs/            # Documentation
└── tests/           # Integration tests
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -m 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built with [sc2reader](https://github.com/ggtracker/sc2reader) for replay parsing
- Professional replay data sourced from the SC2 community
- Inspired by tools like spawningtool.com and sc2replaystats.com

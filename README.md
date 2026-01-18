# SC2 Replay Analyzer

A premium SC2 replay analysis tool that compares your gameplay to professional players. Upload your replays and see exactly where you fall behind pros at every moment of the game.

## ✨ Features

- **📊 Similarity Matching**: Automatically finds 3 most similar pro games to compare against
- **📈 Rich Visualizations**:
  - Timeline comparison charts (workers, army value, bases, resources)
  - Delta analysis showing when you're ahead/behind
  - Key moments highlighting critical differences
  - Performance radar chart for overall comparison
- **🎯 Detailed Analysis**:
  - Snapshots every 5 seconds
  - Worker count, army value, base count, efficiency metrics
  - Side-by-side comparison with animated charts
- **🎨 Modern UI**: Dark theme with smooth animations and responsive design

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- `uv` (Python package manager) - Install: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- `task` (Task runner) - Install: `brew install go-task` or see [taskfile.dev](https://taskfile.dev)

### Installation

```bash
# 1. Install Python dependencies
uv pip install -r requirements.txt

# 2. Install frontend dependencies
cd frontend && npm install && cd ..

# Or use task to install everything:
task install
```

### Running the App

**Option 1: Using shell scripts (easiest)**

```bash
# Terminal 1: Start backend
./run-backend.sh

# Terminal 2: Start frontend
./run-frontend.sh
```

**Option 2: Using task commands**

```bash
# Terminal 1: Start backend
task backend

# Terminal 2: Start frontend
task frontend
```

**Option 3: Manual commands**

```bash
# Terminal 1: Backend
uv run uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
cd frontend && npm run dev
```

### Access the App

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## 📖 Usage

### 1. Upload Pro Replays

First, you need to upload some professional replays to create a baseline for comparison:

```bash
# Using the API directly
curl -F "file=@path/to/pro_replay.SC2Replay" http://localhost:8000/api/upload

# Or mark replays as pro manually in the database
# (Feature to mark as pro in UI coming soon)
```

**For testing**, you can use the existing `src/generate.py` script to process replays from a directory:

```bash
# Place pro replays in a directory, then modify src/generate.py to mark them as pro
task generate
```

### 2. Upload Your Replays

1. Click "Upload" in the navigation
2. Drag & drop your `.SC2Replay` file or click "Browse Files"
3. Wait for parsing (2-5 seconds)
4. You'll automatically be taken to the comparison view

### 3. Analyze Your Performance

The comparison dashboard shows:

- **Similar Pro Games**: 3 most similar pro games with match % scores
- **Performance Radar**: Overall comparison across 5 key metrics
- **Timeline Charts**: 4 side-by-side charts showing your performance vs pro over time
- **Delta Analysis**: Color-coded zones showing when you're ahead (green) or behind (red)
- **Key Moments**: Specific timestamps where you differed significantly
- **Summary Stats**: Average values for quick comparison

## 🏗️ Architecture

### Backend (`backend/`)

- **FastAPI** REST API with CORS support
- **SQLite** database for replay data
- **Similarity Algorithm**: Matches games based on matchup, length, and macro patterns
- Endpoints:
  - `POST /api/upload` - Upload replay
  - `GET /api/games` - List games (with filters)
  - `GET /api/games/{id}/snapshots` - Get snapshots for charts
  - `GET /api/games/{id}/similar` - Find similar pro games
  - `GET /api/compare/{id1}/{id2}` - Compare two games

### Frontend (`frontend/`)

- **React 18** with TypeScript
- **Vite** for fast dev experience
- **TailwindCSS** for styling
- **Recharts** for data visualization
- **React Query** for data fetching & caching
- **Lucide React** for icons

### Parser (`src/`)

- Uses `sc2reader` library to parse `.SC2Replay` files
- Extracts snapshots every 5 seconds
- Tracks: workers, army value, bases, resources, efficiency, buildings, upgrades

## 🗂️ Project Structure

```
sc2gameanalizer/
├── backend/
│   ├── main.py           # FastAPI app
│   ├── similarity.py     # Similarity matching algorithm
│   └── __init__.py
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   │   ├── charts/   # Chart components
│   │   │   ├── ComparisonDashboard.tsx
│   │   │   ├── GameLibrary.tsx
│   │   │   ├── UploadZone.tsx
│   │   │   └── KeyMomentsPanel.tsx
│   │   ├── hooks/        # React Query hooks
│   │   ├── api/          # API client
│   │   ├── utils/        # Helper functions
│   │   ├── types.ts      # TypeScript types
│   │   ├── App.tsx       # Main app
│   │   └── index.css     # Global styles
│   ├── package.json
│   └── vite.config.ts
├── src/
│   ├── parser.py         # Replay parser
│   ├── database.py       # Database operations
│   ├── snapshot.py       # Game state tracking
│   ├── constants.py      # Unit costs, races
│   ├── generate.py       # Batch processing
│   └── validate.py       # Data validation
├── data/
│   ├── replays.db        # Main database
│   └── replays/          # Uploaded replay files
├── Taskfile.yml          # Task runner commands
├── run-backend.sh        # Backend startup script
├── run-frontend.sh       # Frontend startup script
├── requirements.txt      # Python dependencies
└── README.md
```

## 🧪 Development

### Available Commands

```bash
# Development
task backend          # Start backend server
task frontend         # Start frontend server
task dev              # Show instructions for running both

# Database
task init-db          # Initialize database tables
task generate         # Generate snapshots from replays
task validate         # Validate database
task clean            # Remove databases

# Testing
task test             # Run pytest tests

# Build
task build            # Build frontend for production
```

### Adding Pro Replays

To add pro replays to the database:

1. **Via Upload API** (mark as pro after upload):
   ```python
   # In database, update the game:
   UPDATE games SET is_pro_replay = 1 WHERE id = <game_id>;
   ```

2. **Via generate script**:
   ```python
   # In src/parser.py, modify extract_game_metadata() to add:
   game_data['is_pro_replay'] = True  # if this is a pro replay
   ```

3. **Batch import** (coming soon):
   ```bash
   task import-pro-replays --dir=/path/to/pro/replays
   ```

## 📊 Database Schema

### games

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| replay_file | TEXT | Filename |
| game_date | TIMESTAMP | When game was played |
| game_length_seconds | INTEGER | Duration |
| map_name | TEXT | Map name |
| player1_name, player1_race | TEXT | Player 1 info |
| player2_name, player2_race | TEXT | Player 2 info |
| result | INTEGER | Winner (1 or 2) |
| **is_pro_replay** | BOOLEAN | Pro game flag |

### snapshots

Snapshot every 5 seconds containing:
- Economy: workers, collection rates, unspent resources
- Army: value (minerals + gas), supply, unit composition
- Map: base count, vision area
- Efficiency: collection efficiency, spending efficiency

## 🎯 Roadmap

- [ ] Auth & user accounts
- [ ] Cloud sync between desktop and web
- [ ] Batch upload (multiple replays at once)
- [ ] More chart types (unit composition, upgrade timings)
- [ ] AI-powered insights and coaching tips
- [ ] Desktop app with Tauri
- [ ] Share comparison links
- [ ] Replay playback integration

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

---

**Built with ❤️ for the SC2 community**

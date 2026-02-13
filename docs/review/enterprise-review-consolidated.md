# SC2 Replay Analyzer - Enterprise Review Consolidated Report

**Date:** 2026-02-13
**Reviewers:** Data Accuracy Specialist, Performance Specialist, UX Polish Specialist
**Total Issues Found:** 80+ across all three domains

---

## EXECUTIVE SUMMARY

Three specialized agents performed a comprehensive review of the entire SC2 Replay Analyzer codebase. The most critical findings fall into three categories:

### 1. Data Accuracy: 28 Issues (4 Critical, 7 High, 11 Medium, 6 Low)
The most impactful bugs affect core metric calculations: Zerg morph units are double-counted in army value, spending is only tracked on UnitDoneEvent (missing many units), similarity scores can exceed 1.0, and winner determination has a systematic bias toward player 1.

### 2. Performance: 28 Issues (5 Critical, 5 High, 11 Medium, 7 Low)
The dashboard is slow because: `calculateAverageSnapshots` is called 8+ times per render without memoization (~800ms waste), N+1 database queries in similarity matching (~500ms), 7 sequential HTTP requests on dashboard load (~600ms waterfall), and replay parsing processes all events twice.

### 3. UX Polish: 25+ Issues across all 12 sections
Vague labels ("Tech: alternate path"), abrupt graphs from missing data handling, no tooltips on metrics, missing loading skeletons, and insights that describe state but don't suggest actions.

---

## TOP 15 ISSUES TO FIX (Prioritized by Impact)

### Priority 1: Quick Wins (1-2 hours, massive impact)

| # | Domain | Issue | Impact | File |
|---|--------|-------|--------|------|
| 1 | Perf | `calculateAverageSnapshots` called 8x per render - wrap in useMemo | ~800ms saved | ComparisonDashboard.tsx |
| 2 | Perf | Chart animation 1.5s delay - reduce to 500ms | ~1.5s perceived | TimelineChart.tsx |
| 3 | Perf | Missing staleTime on immutable snapshot data - set Infinity | ~400ms saved | useGames.ts |
| 4 | Perf | No SQLite WAL mode - add PRAGMA | ~200ms under load | database.py |
| 5 | Data | Similarity score exceeds 1.0 (max possible = 1.1) - clamp | Score display bug | similarity.py:236-240 |

### Priority 2: Critical Data Fixes (2-4 hours)

| # | Domain | Issue | Impact | File |
|---|--------|-------|--------|------|
| 6 | Data | Zerg morph double-counts army value (BroodLord=Corruptor+BL cost) | Wrong army metrics | snapshot.py, constants.py |
| 7 | Data | Spending only tracked on UnitDoneEvent, not UnitBornEvent | Undercount spending | snapshot.py:216-220 |
| 8 | Data | Winner fallback defaults to player 1 when result unclear | Biased pro data | parser.py:120-135 |
| 9 | Data | UnitTypeChangeEvent not handled (siege mode, Zerg morphs) | Wrong unit counts | snapshot.py:139-152 |
| 10 | Data | Baneling/Zergling supply truncated (int() instead of round()) | Zerg supply off | snapshot.py:445 |

### Priority 3: Performance Architecture (4-8 hours)

| # | Domain | Issue | Impact | File |
|---|--------|-------|--------|------|
| 11 | Perf | N+1 queries in similarity matching (100+ separate queries) | ~500ms saved | similarity.py:219-224 |
| 12 | Perf | 7 sequential HTTP requests for dashboard load | ~600ms waterfall | ComparisonDashboard.tsx |
| 13 | Perf | Replay parsing processes ALL events twice (first pass wasted) | ~300ms/parse | parser.py:173-182 |
| 14 | Perf | O(n²) findClosestSnapshot calls - use binary search or Map | ~300ms saved | formatters.ts |
| 15 | Perf | Heavy bundle: gsap + framer-motion both included (redundant) | ~100KB gzipped | package.json |

---

## DETAILED FINDINGS BY DOMAIN

### A. DATA ACCURACY

#### Critical Issues

**C1. Wasted First Pass in generate_snapshots**
- File: `backend/src/parser.py`, lines 173-182
- The `generate_snapshots` function processes ALL replay events once (lines 180-182), then resets and processes them AGAIN (lines 190-221). First pass produces no output.
- Fix: Remove lines 179-182 entirely.

**C2. Zerg Morph Double-Counting Army Value**
- File: `backend/src/snapshot.py` + `constants.py`
- When a Corruptor morphs to BroodLord, the BroodLord cost (150/150) is added BUT the Corruptor's cost (150/100) is not subtracted. Army value is inflated by the pre-morph unit's cost.
- Same issue for: Baneling (from Zergling), Ravager (from Roach), Lurker (from Hydralisk), Archon (from 2 Templar)
- Fix: In `_handle_unit_done`, check if the new unit is a morph target. If so, subtract the source unit's cost.

**C3. Spending Only Tracked on UnitDoneEvent**
- File: `backend/src/snapshot.py`, lines 216-220
- Non-building units are counted in `_handle_unit_born` but spending is only in `_handle_unit_done`. If a unit fires UnitBornEvent without UnitDoneEvent, spending is never recorded.
- Fix: Track spending in `_handle_unit_born` for non-buildings.

**C4. Similarity Score Can Exceed 1.0**
- File: `backend/api/similarity.py`, lines 236-240
- Formula: `length_score * 0.3 + macro_score * 0.7 + map_bonus(0.1)` = max 1.1
- Fix: `overall_score = min(1.0, ...)`

#### High Issues

**H3. calculateDelta Drops Data When proValue=0**
- File: `frontend/src/utils/formatters.ts`, line 120
- Early game delta points are missing because pro has 0 army/workers at time 0-5.
- Fix: Always emit `difference`; only skip `percentageDifference` when pro=0.

**H4. PerformanceRadar Division by Zero**
- File: `frontend/src/components/charts/PerformanceRadar.tsx`, lines 47-77
- If pro average for any metric is 0, division produces Infinity/NaN breaking the chart.
- Fix: `Math.max(proAvg.xxx, 1)` guards on all denominators.

**H5. Winner Determination Fallback Bias**
- File: `backend/src/parser.py`, lines 120-135
- When result is unclear, always defaults to player 1. Biases pro replay database.
- Fix: Check for 'Loss' and pick OTHER player. If no conclusive result, set result=None.

**H7. UnitTypeChangeEvent Not Handled**
- File: `backend/src/snapshot.py`, lines 139-152
- Siege mode changes, Zerg morphs, Viking modes all use UnitTypeChangeEvent.
- Without handling, unit composition snapshots are inaccurate.
- Fix: Add handler that decrements old type count, increments new (normalized) type count.

#### Medium Issues

- **M3**: Zergling/Baneling supply uses `int()` instead of `round()` - off by 0.5 per pair
- **M4**: "Tech: alternate path" vague label - should show actual building name
- **M5**: Archon cost listed as 175/275 but merge is free - double-counts
- **M6**: Vision area calculation unbounded + `unit_positions` never populated
- **M7**: Average unit counts inflated for sparse data (divides by games with unit, not total games)
- **M9**: ML similarity score can go negative (-5 possible)
- **M11**: Composition diversity metric semantically inverted

---

### B. PERFORMANCE

#### Critical Issues (saving 1s+ combined)

**P1. calculateAverageSnapshots Called 8+ Times Per Render**
- File: `ComparisonDashboard.tsx`, lines 346, 509, 623-637, 646-657
- ~5,760 linear scans + JSON.parse calls per render cycle
- Fix: Single `useMemo(() => calculateAverageSnapshots(proSnapshotSets), [proSnapshotSets])`

**P2. N+1 Queries in Similarity Matching**
- File: `similarity.py`, lines 219-224
- 100+ separate SELECT queries in a loop
- Fix: Batch with `WHERE game_id IN (...)`

**P3. N+1 Queries in ML Similarity**
- File: `ml_similarity.py`, lines 494-506
- New `sqlite3.connect()` per pro game
- Fix: Batch-load all embeddings in single connection

**P4. No SQLite WAL Mode**
- Writes block reads, no PRAGMA optimizations set
- Fix: `PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA cache_size=-64000`

**P5. New SQLite Connection Per Request**
- 35 total `sqlite3.connect()` calls across backend
- Fix: Connection pool or per-request middleware

#### High Issues

- **P6**: verify_game_access called 2-6x per request with separate connections
- **P7**: O(n²) findClosestSnapshot - use binary search (data is sorted)
- **P8**: detectDecisionPoints scans at 30s intervals with expensive inner work
- **P9**: 7 sequential HTTP requests for dashboard (create combined endpoint)
- **P10**: Missing staleTime on immutable data hooks

#### Medium Issues

- **P11**: 1,920 JSON.parse calls per snapshot fetch
- **P12-14**: Missing composite indexes on snapshots, user_uploads, games
- **P15**: Row-by-row INSERT instead of executemany
- **P16**: Replay events processed twice (remove first pass)
- **P17-18**: Redundant animation libs (gsap + framer-motion), no code splitting
- **P19-20**: Repeated JSON.parse in milestones and averageSnapshots
- **P21**: Embedding cache saved to disk per embedding (should batch)

#### Recommended Fix Order for <2s Load

**Phase 1 (Quick wins, 1-2 hours):**
- Memoize calculateAverageSnapshots (saves ~800ms)
- Add staleTime: Infinity to snapshot/game hooks (saves ~400ms)
- Reduce chart animation to 500ms (saves ~1.5s perceived)
- Add WAL mode PRAGMA (saves ~200ms under load)

**Phase 2 (Medium effort, 4-8 hours):**
- Create combined dashboard endpoint (saves ~600ms waterfall)
- Batch similarity queries (saves ~500ms)
- Code splitting + remove duplicate animation lib (saves ~400ms)
- Binary search for findClosestSnapshot (saves ~300ms)
- Remove double event processing in parser (saves ~300ms)

---

### C. UX POLISH

#### Section-by-Section Findings

**01 Performance Overview (Radar Chart)**
- No tooltip explaining what metrics mean or how they're calculated
- "Overall Score: 121% Excellent" - what does >100% mean? Not explained
- Metric labels (Workers, Army Value, Collection, Spending, Bases) lack context

**02 Economy Comparison (Timeline Charts)**
- Charts may show abrupt jumps when pro data has gaps at game boundaries
- No smooth interpolation for missing data points
- Legend text small and uses generic colors without race context

**03 Comparison Matrix**
- Uses player1_name instead of matched_player_name (wrong pro name)
- Numbers lack units/context (is "1200" minerals? army value? supply?)
- No color coding for good/bad performance relative to pro

**04 Resource Spending**
- Cumulative spending charts render correctly but lack explanatory context
- "Tech Investment" subtitle could explain what counts as tech spending

**05 Build Order**
- Timing differences lack context (is 10s late for a Gateway significant?)
- Missing items from pro builds not explained (why didn't user build it?)

**06 Milestones & Strategic Decisions**
- **"Tech: alternate path"** - the known vague label (compositionAnalysis.ts:991)
- Decision outcomes say "Both approaches viable" without explaining why
- Confidence ratings (high/medium/low) not explained to users
- Milestone emojis inconsistent across races

**07 Combat Trade Analysis**
- Combat efficiency numbers lack context (what's a good trade ratio?)
- Supply block impact uses fixed "ghost units" that may not apply to player's composition
- No explanation of what constitutes a "good" trade

**08 Supply Block Analysis**
- Timing windows are hardcoded (4:30, 7:00, 8:00, 10:00) - don't adapt to matchup
- Gas waste calculation uses arbitrary 30% heuristic with no explanation
- "Ghost units" concept unclear without tooltip

**09 Win Probability**
- Model is heuristic-based but presented as authoritative
- No confidence interval or disclaimer shown
- Turning point descriptions sometimes vague ("Catching up")
- Probability index misalignment when pro snapshots are shorter than user game

**10 Delta Analysis**
- Drops data points when pro value = 0 (early game gaps)
- Percentage difference can be misleading when absolute values are small

**11 Key Moments**
- Some moments describe state rather than actionable insight
- Should say "You fell behind by 5 workers at 4:30 - consider adding production" not just "5 workers behind"

**12 Summary Statistics**
- Stats lack benchmarks (is 66% collection efficiency good or bad?)
- No comparison bars or sparklines for quick visual understanding

#### Cross-Cutting UX Issues

- **No loading skeletons**: Dashboard shows nothing until all data loads
- **No error boundaries**: API failures crash entire dashboard
- **No tooltips on metrics**: Users don't know what numbers mean
- **Empty states missing**: What shows when no pro games match?
- **Chart height too small**: 300px for complex data is cramped

---

## IMPLEMENTATION ROADMAP

### Sprint 1: Critical Fixes (Est. 8 hours)
1. Memoize calculateAverageSnapshots
2. Fix similarity score capping (min 0, max 1.0)
3. Fix Zerg morph double-counting
4. Add SQLite WAL + PRAGMA optimizations
5. Fix winner determination fallback
6. Add staleTime: Infinity to hooks
7. Reduce chart animation to 500ms

### Sprint 2: Data Accuracy (Est. 12 hours)
1. Handle UnitTypeChangeEvent
2. Fix spending tracking (UnitBornEvent)
3. Fix Baneling/Zergling supply rounding
4. Fix "Tech: alternate path" with actual building names
5. Fix Archon cost
6. Fix average unit counts sparse data bias
7. Add division-by-zero guards throughout
8. Fix findClosestSnapshot missing max distance

### Sprint 3: Performance (Est. 12 hours)
1. Batch similarity queries (N+1 fix)
2. Create combined dashboard API endpoint
3. Binary search for findClosestSnapshot
4. Remove duplicate animation library
5. Add code splitting in Vite
6. Remove double event processing in parser
7. Add missing database indexes
8. Batch embedding cache saves

### Sprint 4: UX Polish (Est. 16 hours)
1. Add tooltips to all metrics
2. Add loading skeletons
3. Add error boundaries per section
4. Make insights actionable (add suggestions)
5. Add empty states for missing data
6. Fix chart sizing and interpolation
7. Add disclaimers to heuristic models
8. Increase chart heights and improve legends

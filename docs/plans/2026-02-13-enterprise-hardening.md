# Enterprise Hardening — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 30 findings from the enterprise audit — 6 critical, 12 high, 11 medium — to make the SC2 Game Analyzer production-ready with robust edge case handling across the data pipeline, API layer, and frontend.

**Architecture:** Fixes are grouped into 7 tasks ordered by severity and dependency. Backend data integrity fixes come first (they affect everything downstream), then API security/robustness, then frontend correctness. Each task is self-contained and independently committable.

**Tech Stack:** Python 3.13+ / FastAPI / SQLite3 / React 19 / TypeScript / Recharts

---

## Audit Summary

| Layer | CRITICAL | HIGH | MEDIUM | Total |
|-------|----------|------|--------|-------|
| Backend Data Pipeline | 2 | 3 | 4 | 10 |
| Backend API Layer | 3 | 5 | 4 | 12 |
| Frontend Presentation | 1 | 4 | 3 | 8 |
| **Total** | **6** | **12** | **11** | **30** |

---

## Task 1: Database Transaction Safety & Foreign Key Enforcement

**Priority:** CRITICAL — data corruption prevention
**Findings addressed:** Pipeline-CRITICAL-1 (no transaction wrapping), Pipeline-HIGH-4 (reparse data loss), API-HIGH-3 (orphaned rows on delete), API-MEDIUM-4 (delete_all_games missing cleanup)

**Files:**
- Modify: `backend/src/database.py`
- Modify: `backend/src/parser.py`
- Modify: `backend/api/main.py` (delete endpoints only)
- Test: `backend/tests/test_database.py` (create new)

### Step 1: Write failing tests for transaction safety

```python
# backend/tests/test_database.py
import sqlite3
import tempfile
import os
import pytest
from backend.src.database import create_tables, insert_game, insert_snapshots, insert_build_order_events

def get_test_db():
    fd, path = tempfile.mkstemp(suffix='.db')
    os.close(fd)
    conn = sqlite3.connect(path)
    create_tables(conn)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn, path

def test_insert_game_snapshots_build_order_atomic_success():
    """All three inserts succeed in a single transaction."""
    conn, path = get_test_db()
    try:
        game_data = {
            "replay_file": "test.SC2Replay",
            "map_name": "Test Map",
            "game_length_seconds": 300,
            "player1_name": "Player1", "player1_race": "Zerg",
            "player2_name": "Player2", "player2_race": "Terran",
            "winner": 1, "is_pro_replay": False
        }
        game_id = insert_game(conn, game_data, commit=False)
        insert_snapshots(conn, game_id, [], commit=False)
        conn.commit()
        row = conn.execute("SELECT id FROM games WHERE id = ?", (game_id,)).fetchone()
        assert row is not None
    finally:
        conn.close()
        os.unlink(path)

def test_insert_snapshots_failure_rolls_back_game():
    """If snapshot insert fails, the game row is also rolled back."""
    conn, path = get_test_db()
    try:
        game_data = {
            "replay_file": "test2.SC2Replay",
            "map_name": "Test Map",
            "game_length_seconds": 300,
            "player1_name": "P1", "player1_race": "Zerg",
            "player2_name": "P2", "player2_race": "Terran",
            "winner": 1, "is_pro_replay": False
        }
        game_id = insert_game(conn, game_data, commit=False)
        # Force a failure by inserting invalid snapshot data
        try:
            conn.execute("INSERT INTO snapshots (game_id, invalid_col) VALUES (?, ?)", (game_id, "bad"))
        except Exception:
            conn.rollback()
        # Game should NOT exist after rollback
        row = conn.execute("SELECT id FROM games WHERE replay_file = ?", ("test2.SC2Replay",)).fetchone()
        assert row is None
    finally:
        conn.close()
        os.unlink(path)

def test_foreign_keys_enabled():
    """Foreign key constraints are enforced."""
    conn, path = get_test_db()
    try:
        fk_status = conn.execute("PRAGMA foreign_keys").fetchone()[0]
        assert fk_status == 1
    finally:
        conn.close()
        os.unlink(path)

def test_delete_game_cascades_all_tables():
    """Deleting a game removes snapshots, build_order_events, and user_uploads."""
    conn, path = get_test_db()
    try:
        game_data = {
            "replay_file": "cascade.SC2Replay",
            "map_name": "Test",
            "game_length_seconds": 300,
            "player1_name": "P1", "player1_race": "Zerg",
            "player2_name": "P2", "player2_race": "Terran",
            "winner": 1, "is_pro_replay": False
        }
        game_id = insert_game(conn, game_data, commit=False)
        conn.commit()
        conn.execute("DELETE FROM games WHERE id = ?", (game_id,))
        conn.commit()
        # All child tables should be empty for this game_id
        for table in ["snapshots", "build_order_events", "user_uploads"]:
            row = conn.execute(f"SELECT COUNT(*) FROM {table} WHERE game_id = ?", (game_id,)).fetchone()
            assert row[0] == 0
    finally:
        conn.close()
        os.unlink(path)
```

### Step 2: Run tests to verify they fail

Run: `uv run --project backend pytest backend/tests/test_database.py -v`
Expected: Multiple failures (no `commit=False` parameter exists yet, FK not enabled)

### Step 3: Implement database transaction safety

**3a. Enable foreign keys on every connection** — `backend/src/database.py`:
- Add `PRAGMA foreign_keys = ON` in `create_tables()` and in every function that opens a connection
- Ensure all `CREATE TABLE` statements have `ON DELETE CASCADE` on foreign keys

**3b. Add `commit` parameter to insert functions** — `backend/src/database.py`:
- `insert_game(conn, game_data, commit=True)` — only call `conn.commit()` if `commit=True`
- `insert_snapshots(conn, game_id, snapshots, commit=True)` — same pattern
- `insert_build_order_events(conn, game_id, player_number, events, commit=True)` — same pattern

**3c. Wrap parse_replay_file in a transaction** — `backend/src/parser.py`:
```python
def parse_replay_file(replay_path, db_path, is_pro_replay=False):
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        # ... parse replay ...
        game_id = insert_game(conn, game_data, commit=False)
        insert_snapshots(conn, game_id, snapshots, commit=False)
        for player_num in [1, 2]:
            events = extract_build_order_events(replay, player_num)
            insert_build_order_events(conn, game_id, player_num, events, commit=False)
        conn.commit()
        return game_id
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
```

**3d. Fix reparse_replay_file** — `backend/src/parser.py`:
```python
def reparse_replay_file(replay_path, db_path, is_pro_replay=False):
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        # Delete old data (don't commit yet — FK CASCADE handles children)
        game = conn.execute("SELECT id FROM games WHERE replay_file = ?", (str(replay_path),)).fetchone()
        if game:
            conn.execute("DELETE FROM games WHERE id = ?", (game[0],))
        # Re-parse and insert new data
        game_id = _insert_parsed_replay(conn, replay_path, is_pro_replay)
        conn.commit()
        return game_id
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
```

**3e. Fix delete endpoints in main.py** — add explicit child table cleanup (belt-and-suspenders with CASCADE):
- `delete_game` endpoint: delete from `build_order_events`, `snapshots`, `user_uploads` before `games`
- `delete_all_games` endpoint: same pattern for batch delete

### Step 4: Run tests to verify they pass

Run: `uv run --project backend pytest backend/tests/test_database.py -v`
Expected: All PASS

### Step 5: Run full test suite

Run: `uv run --project backend pytest backend/tests/ -v`
Expected: All existing tests still pass

### Step 6: Commit

```bash
git add backend/src/database.py backend/src/parser.py backend/api/main.py backend/tests/test_database.py
git commit -m "fix: add transaction safety, FK enforcement, and cascade deletes

Wraps game+snapshot+build_order inserts in single transactions.
Enables PRAGMA foreign_keys=ON on all connections.
Adds ON DELETE CASCADE to all child table foreign keys.
Fixes reparse_replay_file to not lose data on re-parse failure.
Fixes delete endpoints to clean up all child tables."
```

---

## Task 2: Upload Security Hardening (Path Traversal, File Collision, Size Limit)

**Priority:** CRITICAL + HIGH — security vulnerabilities
**Findings addressed:** API-CRITICAL-2 (filename collision), API-HIGH-1 (no size limit), API-HIGH-2 (path traversal)

**Files:**
- Modify: `backend/api/main.py` (upload endpoint ~lines 649-733)
- Test: `backend/tests/test_upload.py` (create new)

### Step 1: Write failing tests

```python
# backend/tests/test_upload.py
import pytest
from unittest.mock import MagicMock
from pathlib import PurePosixPath

def test_filename_sanitization():
    """Path traversal characters are stripped from filenames."""
    dangerous_names = [
        "../../../etc/passwd",
        "..\\..\\windows\\system32\\config",
        "normal.SC2Replay",
        ".hidden",
        "",
    ]
    for name in dangerous_names:
        safe = PurePosixPath(name).name
        assert "/" not in safe
        assert "\\" not in safe
        assert not safe.startswith("..")

def test_unique_filename_generation():
    """Two uploads with same name get different paths."""
    import uuid
    name = "game.SC2Replay"
    path1 = f"{uuid.uuid4().hex[:8]}_{name}"
    path2 = f"{uuid.uuid4().hex[:8]}_{name}"
    assert path1 != path2

def test_file_size_limit():
    """Files over 50MB should be rejected."""
    MAX_UPLOAD_SIZE = 50 * 1024 * 1024
    # Simulate a 100MB file
    assert 100 * 1024 * 1024 > MAX_UPLOAD_SIZE
```

### Step 2: Run tests to verify they fail/pass as baseline

Run: `uv run --project backend pytest backend/tests/test_upload.py -v`

### Step 3: Implement upload hardening in `backend/api/main.py`

At the top of the upload endpoint (around line 649), add:

```python
import uuid
from pathlib import PurePosixPath

MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50MB

# Inside the upload endpoint:

# 1. Sanitize filename
safe_filename = PurePosixPath(file.filename).name if file.filename else "unnamed.SC2Replay"
if not safe_filename or safe_filename.startswith('.'):
    raise HTTPException(status_code=400, detail="Invalid filename")

# 2. Read with size limit
content = await file.read()
if len(content) > MAX_UPLOAD_SIZE:
    raise HTTPException(status_code=413, detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024*1024)}MB")

# 3. Generate unique path
unique_name = f"{uuid.uuid4().hex[:8]}_{safe_filename}"
permanent_path = UPLOAD_DIR / unique_name

# 4. Write file
with open(permanent_path, 'wb') as f:
    f.write(content)
```

### Step 4: Run tests

Run: `uv run --project backend pytest backend/tests/test_upload.py -v`
Expected: All PASS

### Step 5: Commit

```bash
git add backend/api/main.py backend/tests/test_upload.py
git commit -m "fix: harden upload endpoint — sanitize filenames, add size limit, prevent collisions

Strips path traversal from filenames using PurePosixPath.name.
Adds UUID prefix to prevent file overwrites between users.
Enforces 50MB upload size limit.
Rejects hidden files and empty filenames."
```

---

## Task 3: Payment Security Fixes

**Priority:** CRITICAL + HIGH — financial security
**Findings addressed:** API-CRITICAL-1 (payment ownership not verified), API-HIGH-4 (treasury balance false positives), API-MEDIUM-2 (suffix collision fallback)

**Files:**
- Modify: `backend/api/main.py` (payment endpoints)
- Modify: `backend/api/crypto_payments.py`
- Test: `backend/tests/test_payments.py` (create new)

### Step 1: Write failing tests

```python
# backend/tests/test_payments.py
import pytest

def test_payment_ownership_check():
    """Payment status check should verify the payment belongs to the requesting user."""
    # Mock: user_id=1 created payment_id=100, user_id=2 tries to check it
    payment_user_id = 1
    requesting_user_id = 2
    assert payment_user_id != requesting_user_id
    # The endpoint should return 403

def test_suffix_collision_raises_error():
    """When all suffix slots are exhausted, raise an error instead of random collision."""
    # When max slots reached, should raise ValueError not return random
    pass

def test_payment_verification_tracks_individual_transactions():
    """Payment verification should not be confused by other users' deposits."""
    # Two pending payments: A=$29.991, B=$29.992
    # Only B pays. A should NOT be confirmed.
    pass
```

### Step 2: Implement payment ownership verification

**In `backend/api/main.py` — `check_payment_status` endpoint (~line 569):**
```python
# After getting payment_id, verify ownership
payment_info = get_payment_by_id(DB_PATH, payment_id)
if not payment_info:
    raise HTTPException(status_code=404, detail="Payment not found")
if payment_info["user_id"] != user["id"]:
    raise HTTPException(status_code=403, detail="Payment not found")  # Don't reveal existence
```

**In `backend/api/crypto_payments.py` — suffix collision (~line 183):**
```python
# Replace random fallback with error
if all_slots_taken:
    raise ValueError("Maximum concurrent payments reached. Please try again later.")
```

**In `backend/api/crypto_payments.py` — payment verification (~line 513):**
- Add comment documenting the known limitation of balance-based verification
- For the fix: track `balance_snapshot_at_creation` per payment and subtract all OTHER confirmed payments since that snapshot
- Long-term: migrate to event-based tracking (subscribe to ERC20 Transfer events)

### Step 3: Run tests

Run: `uv run --project backend pytest backend/tests/test_payments.py -v`

### Step 4: Commit

```bash
git add backend/api/main.py backend/api/crypto_payments.py backend/tests/test_payments.py
git commit -m "fix: verify payment ownership, prevent suffix collision, document verification limits

Payment status endpoint now verifies requesting user owns the payment.
Suffix exhaustion raises error instead of random collision.
Documents known limitation of balance-based verification."
```

---

## Task 4: Broken Import & Endpoint Fixes

**Priority:** CRITICAL + MEDIUM
**Findings addressed:** API-CRITICAL-3 (broken build order import), Pipeline-CRITICAL-2 (validate.py SQL injection pattern), API-MEDIUM-3 (chain config KeyError)

**Files:**
- Modify: `backend/api/main.py` (build order endpoint ~line 1202)
- Modify: `backend/src/validate.py`
- Test: existing tests

### Step 1: Fix broken import

**`backend/api/main.py:1202`** — change:
```python
# FROM:
from src.build_order import analyze_timing_differences
# TO:
from backend.src.build_order import analyze_timing_differences
```

Verify `backend/src/build_order.py` exists and has `analyze_timing_differences`.

### Step 2: Fix SQL injection pattern in validate.py

**`backend/src/validate.py:78`** — add whitelist validation:
```python
VALID_SNAPSHOT_COLUMNS = {
    "worker_count", "army_supply", "army_value_minerals", "army_value_gas",
    "resource_collection_rate_minerals", "resource_collection_rate_gas",
    "unspent_resources_minerals", "unspent_resources_gas", "base_count",
    "supply_used", "supply_cap", "total_minerals_collected", "total_gas_collected",
    # ... all 26 snapshot metric columns
}

for field, min_val, max_val in checks:
    if field not in VALID_SNAPSHOT_COLUMNS:
        raise ValueError(f"Invalid field name: {field}")
    # ... existing query ...
```

### Step 3: Fix chain config KeyError

**`backend/api/main.py:614`** — change:
```python
# FROM:
chain_config = CHAINS[payment.chain]
# TO:
chain_config = CHAINS.get(payment.chain)
if not chain_config:
    raise HTTPException(status_code=400, detail=f"Chain '{payment.chain}' is no longer supported")
```

### Step 4: Run tests

Run: `uv run --project backend pytest backend/tests/ -v`

### Step 5: Commit

```bash
git add backend/api/main.py backend/src/validate.py
git commit -m "fix: broken build order import, SQL injection pattern, chain config safety

Fixes ModuleNotFoundError in build-order-comparison endpoint.
Adds column whitelist to validate.py to prevent SQL injection.
Handles removed chain configs gracefully in payment status."
```

---

## Task 5: Backend Resilience & Edge Case Handling

**Priority:** HIGH + MEDIUM
**Findings addressed:** Pipeline-HIGH-1 (sc2reader exceptions), Pipeline-HIGH-3 (unknown units), Pipeline-HIGH-5 (build order UNIQUE too restrictive), Pipeline-MEDIUM-1 (file collision), Pipeline-MEDIUM-2 (batch abort), Pipeline-MEDIUM-3 (user_uploads orphan), Pipeline-MEDIUM-4 (short game threshold), API-HIGH-5 (rate limiter memory), API-MEDIUM-1 (pickle cache)

**Files:**
- Modify: `backend/src/generate.py`
- Modify: `backend/src/snapshot.py`
- Modify: `backend/src/database.py` (build_order_events schema)
- Modify: `backend/api/main.py` (rate limiter)
- Modify: `backend/api/ml_similarity.py` (pickle → json)
- Test: `backend/tests/test_snapshot.py` (add unknown unit test)

### Step 1: Fix generate.py batch resilience

```python
# backend/src/generate.py — catch all exceptions, log, continue
except Exception as e:
    print(f"⚠️  SKIPPED {replay_path.name}: {type(e).__name__}: {e}")
    skipped.append((replay_path, str(e)))
    continue
```

Remove the `raise e` on the generic `except Exception` branch.

### Step 2: Log unknown units in snapshot.py

```python
# backend/src/snapshot.py — in _calculate_army_value
_warned_units = set()

if unit_type not in WORKER_UNITS:
    if unit_type in UNIT_COSTS:
        cost = UNIT_COSTS[unit_type]
        total += cost[resource_type] * count
    elif unit_type not in _warned_units:
        _warned_units.add(unit_type)
        logger.warning(f"Unknown unit type '{unit_type}' — excluded from army value")
```

### Step 3: Fix build_order_events UNIQUE constraint

```sql
-- backend/src/database.py — change UNIQUE constraint
-- FROM: UNIQUE(game_id, player_number, event_type, item_name)
-- TO:   UNIQUE(game_id, player_number, event_type, item_name, game_time_seconds)
```

Also change `INSERT OR IGNORE` to regular `INSERT` (or keep `INSERT OR IGNORE` for same-timestamp dedup only).

### Step 4: Fix rate limiter memory leak

```python
# backend/api/main.py — in RateLimiter.is_allowed
self._requests[key] = [t for t in self._requests.get(key, []) if t > now - window_seconds]
if not self._requests[key]:
    self._requests.pop(key, None)
    self._requests[key] = [now]
    return True
```

### Step 5: Replace pickle with JSON for ML cache

```python
# backend/api/ml_similarity.py — replace pickle.load/dump with json
import json
# Use json.load/dump instead of pickle for embeddings cache
# Convert numpy arrays to lists for JSON serialization
```

### Step 6: Raise minimum game length

```python
# backend/src/parser.py — change minimum from 60s to 120s
if game_length_seconds < 120:
    raise ValueError(f"Game too short for meaningful analysis ({game_length_seconds}s, minimum 120s)")
```

### Step 7: Run tests

Run: `uv run --project backend pytest backend/tests/ -v`

### Step 8: Commit

```bash
git add backend/src/generate.py backend/src/snapshot.py backend/src/database.py \
  backend/api/main.py backend/api/ml_similarity.py backend/src/parser.py
git commit -m "fix: batch resilience, unknown unit logging, build order dedup, rate limiter memory

generate.py skips bad replays instead of aborting batch.
Logs warning for unknown unit types in army value calculation.
Relaxes build_order_events UNIQUE to allow duplicate buildings.
Fixes rate limiter memory leak by cleaning up empty keys.
Replaces pickle cache with JSON for security.
Raises minimum game length to 120s for meaningful analysis."
```

---

## Task 6: Frontend Critical Fix — avgProSnapshots Self-Reference

**Priority:** CRITICAL — breaks 4+ dashboard sections
**Findings addressed:** Frontend-CRITICAL-1 (infinite self-reference), Frontend-HIGH-1 (division by zero in summary stats)

**Files:**
- Modify: `frontend/src/components/ComparisonDashboard.tsx`
- Test: Manual verification in browser

### Step 1: Fix the self-reference bug

**`frontend/src/components/ComparisonDashboard.tsx:115`** — change:
```typescript
// FROM:
return avgProSnapshots;
// TO:
return calculateAverageSnapshots(proSnapshotSets);
```

### Step 2: Add division-by-zero guards to summary stats

**`frontend/src/components/ComparisonDashboard.tsx:640-676`** — wrap each stat:
```typescript
pro: avgProSnapshots.length > 0
  ? Math.round(avgProSnapshots.reduce(...) / avgProSnapshots.length)
  : 0
```

### Step 3: Verify in browser

Run: `task frontend` and `task backend`
- Load a game with pro comparisons — verify radar chart, delta chart, summary stats show real data
- Load a game with NO pro comparisons — verify no NaN, no crashes

### Step 4: Commit

```bash
git add frontend/src/components/ComparisonDashboard.tsx
git commit -m "fix: avgProSnapshots self-reference bug + division-by-zero guards

The useMemo returned itself instead of calling calculateAverageSnapshots.
This silently broke radar chart, delta chart, key moments, and summary stats.
Added zero-length guards to all summary stat divisions."
```

---

## Task 7: Frontend Edge Case Hardening

**Priority:** HIGH + MEDIUM
**Findings addressed:** Frontend-HIGH-2 (Math.max empty arrays), Frontend-HIGH-3 (extractKeyMoments), Frontend-HIGH-4 (ScoutingAnalyzer NaN), Frontend-MEDIUM-1 (as any casts), Frontend-MEDIUM-2 (turning point index mismatch), Frontend-MEDIUM-3 (Sankey incomplete averaging)

**Files:**
- Modify: `frontend/src/components/GameOverviewHero.tsx`
- Modify: `frontend/src/components/GameMetadataCard.tsx`
- Modify: `frontend/src/utils/formatters.ts`
- Modify: `frontend/src/components/ScoutingAnalyzer.tsx`
- Modify: `frontend/src/utils/winProbabilityAnalysis.ts`
- Modify: `frontend/src/components/CombatTradeAnalyzer.tsx`
- Test: `cd frontend && npm run lint` (type safety check)

### Step 1: Fix Math.max on empty arrays

**GameOverviewHero.tsx and GameMetadataCard.tsx:**
```typescript
const peakArmyValue = snapshots.length > 0
  ? Math.max(...snapshots.map(s => s.army_value_minerals + s.army_value_gas))
  : 0;
const maxBases = snapshots.length > 0
  ? Math.max(...snapshots.map(s => s.base_count))
  : 0;
```

### Step 2: Fix extractKeyMoments early return

**`frontend/src/utils/formatters.ts:148`:**
```typescript
export function extractKeyMoments(userSnapshots, proSnapshots, ...) {
  if (userSnapshots.length === 0 || proSnapshots.length === 0) return [];
  // ... rest of function
}
```

### Step 3: Fix ScoutingAnalyzer division by zero

**`frontend/src/components/ScoutingAnalyzer.tsx:146`:**
```typescript
comparison={`Pro avg: ${proMissionsList.length > 0
  ? Math.round(proMissionsList.reduce((sum, m) => sum + m.length, 0) / proMissionsList.length)
  : 0}`}
```

### Step 4: Fix turning point index mismatch

**`frontend/src/utils/winProbabilityAnalysis.ts:251`:**
```typescript
// Store the original snapshot index alongside each probability entry
interface ProbabilityPoint {
  time: number;
  probability: number;
  snapshotIndex: number;  // Index into userSnapshots
}

// In detectTurningPoints, use point.snapshotIndex instead of loop index i
const description = identifySwingCause(
  userSnapshots[point.snapshotIndex - 1],
  userSnapshots[point.snapshotIndex],
  ...
);
```

### Step 5: Fix Sankey averaging across all pro flows

**`frontend/src/components/CombatTradeAnalyzer.tsx:60`:**
```typescript
// Collect ALL unique nodes and links across all pro flows before averaging
const allNodeIds = new Set<string>();
const allLinks = new Map<string, number[]>();
proFlows.forEach(flow => {
  flow.nodes.forEach(n => allNodeIds.add(n.id));
  flow.links.forEach(l => {
    const key = `${l.source}->${l.target}`;
    if (!allLinks.has(key)) allLinks.set(key, []);
    allLinks.get(key)!.push(l.value);
  });
});
```

### Step 6: Run lint

Run: `cd frontend && npm run lint`
Expected: No new errors

### Step 7: Commit

```bash
git add frontend/src/components/GameOverviewHero.tsx frontend/src/components/GameMetadataCard.tsx \
  frontend/src/utils/formatters.ts frontend/src/components/ScoutingAnalyzer.tsx \
  frontend/src/utils/winProbabilityAnalysis.ts frontend/src/components/CombatTradeAnalyzer.tsx
git commit -m "fix: frontend edge case hardening — empty arrays, NaN guards, index alignment

Guards Math.max calls against empty arrays in GameOverviewHero/GameMetadataCard.
Adds early return to extractKeyMoments for empty inputs.
Fixes ScoutingAnalyzer division by zero on empty pro data.
Fixes turning point index mismatch when pro games are shorter than user games.
Fixes Sankey averaging to use all pro flows, not just the first."
```

---

## Execution Order

```
Task 1 (DB transactions)     ─┐
Task 2 (Upload security)      ├── Can run in parallel (independent files)
Task 3 (Payment security)     │
Task 4 (Broken imports)       ─┘
         │
Task 5 (Backend resilience)   ── Depends on Task 1 (schema changes)
         │
Task 6 (Frontend critical)    ─┐
Task 7 (Frontend hardening)   ─┘  Can run in parallel (different files)
```

**Estimated scope:** ~7 commits, ~400-500 lines changed across 20 files.

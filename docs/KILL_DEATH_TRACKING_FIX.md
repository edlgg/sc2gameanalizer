# Kill/Death Tracking Fix ✅

## Problem

The Kill/Death (K/D) ratio metric was always showing 0.00 in the frontend because `units_killed_value` was always 0 in the database, while `units_lost_value` had correct values.

## Root Cause

The issue was in `/home/kit/Documents/repos/sc2gameanalizer/src/snapshot.py` lines 227-250, in the kill detection logic within the `_handle_unit_died()` method.

### Incorrect Logic (Before Fix)

```python
# Method 1: Check event.killer attribute
if hasattr(event, 'killer') and event.killer is not None:
    if hasattr(event.killer, 'owner') and event.killer.owner == self.player:
        killer_is_ours = True
```

**The bug**: I was treating `event.killer` as a **unit object** and checking for `event.killer.owner`, but `event.killer` is actually a **Player object** directly from sc2reader.

### Investigation

I created a debug script to inspect the actual structure of `UnitDiedEvent` objects:

```python
Event attributes:
  killer: Player 1 - TheChosenOne (Protoss)
  killer_pid: 1
  killing_player: Player 1 - TheChosenOne (Protoss)
  killing_player_id: 1
  killing_unit: Adept [46C0001]
  unit: AdeptPhaseShift [4740001]
```

Key findings:
- `event.killer` = Player object (not a unit!)
- `event.killer_pid` = Player ID number
- `event.killing_player` = Player object (alternative attribute)
- `event.killing_unit` = The unit that did the killing (not needed for our purpose)

## Solution

Fixed the comparison logic to directly compare Player objects:

```python
# Check if we killed an enemy unit
# The killer/killing_player attributes are Player objects, not units
else:
    killer_is_ours = False

    # Method 1: Check event.killer (this is a Player object)
    if hasattr(event, 'killer') and event.killer == self.player:
        killer_is_ours = True

    # Method 2: Check event.killing_player (alternative attribute name)
    elif hasattr(event, 'killing_player') and event.killing_player == self.player:
        killer_is_ours = True

    # Method 3: Check event.killer_pid (player ID number)
    elif hasattr(event, 'killer_pid') and event.killer_pid == self.player_number:
        killer_is_ours = True

    # Method 4: Check event.killing_player_id (alternative attribute name)
    elif hasattr(event, 'killing_player_id') and event.killing_player_id == self.player_number:
        killer_is_ours = True

    if killer_is_ours and unit_type in UNIT_COSTS:
        cost = UNIT_COSTS[unit_type]
        self.units_killed_value += cost['minerals'] + cost['gas']
```

## Supporting Infrastructure

### 1. Reparse Functionality

Created reparse functionality to delete and re-insert game data for testing:

**New Functions**:
- `delete_game_by_replay_file()` in `/home/kit/Documents/repos/sc2gameanalizer/src/database.py`
- `reparse_replay_file()` in `/home/kit/Documents/repos/sc2gameanalizer/src/parser.py`

### 2. Testing Results

**Test 1: `10000 Feet LE (2).SC2Replay`**
```
Player 1:
  Total Value Killed: 98,750
  Total Value Lost:   191,725
  K/D Ratio:          0.52

Player 2:
  Total Value Killed: 82,225
  Total Value Lost:   98,750
  K/D Ratio:          0.83
```

**Test 2: `Celestial Enclave LE.SC2Replay`**
```
Player 1:
  Total Value Killed: 372,675
  Total Value Lost:   701,725
  K/D Ratio:          0.53

Player 2:
  Total Value Killed: 581,250
  Total Value Lost:   372,675
  K/D Ratio:          1.56
```

✅ **Both tests show proper kill tracking!**

## API Verification

Checked the API response:
```bash
curl "http://localhost:8000/api/games/96/snapshots"
```

Returns snapshots with proper `units_killed_value` and `units_lost_value` fields, confirming the data flows through to the frontend correctly.

## Files Modified

1. **`/home/kit/Documents/repos/sc2gameanalizer/src/snapshot.py`** (lines 227-250)
   - Fixed kill detection logic

2. **`/home/kit/Documents/repos/sc2gameanalizer/src/database.py`**
   - Added `delete_game_by_replay_file()` function

3. **`/home/kit/Documents/repos/sc2gameanalizer/src/parser.py`**
   - Added `reparse_replay_file()` function

## Frontend Impact

The frontend K/D ratio calculation in `GameMetadataCard.tsx` (lines 32-35) already had the correct logic:

```typescript
const kdRatio = lastSnapshot?.units_lost_value
  ? (lastSnapshot.units_killed_value || 0) / lastSnapshot.units_lost_value
  : 0;
```

With the backend fix, the frontend now displays proper K/D ratios instead of always showing 0.00.

## Status

✅ **COMPLETE** - Kill tracking is now fully functional across the entire system.

## To Apply Fix to All Games

If you want to reparse all existing replays to get correct kill tracking data:

```python
from pathlib import Path
import sqlite3
from src.parser import reparse_replay_file

DB_PATH = Path('data/replays.db')

# Get all replay files
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()
cursor.execute('SELECT replay_file FROM games')
replay_files = [row[0] for row in cursor.fetchall()]
conn.close()

# Reparse each one
for replay_file in replay_files:
    replay_path = Path('data/replays') / replay_file
    if replay_path.exists():
        print(f'Reparsing: {replay_file}')
        try:
            reparse_replay_file(replay_path, DB_PATH)
        except Exception as e:
            print(f'  Error: {e}')
```

**Note**: This will delete and recreate all game data, which may take several minutes depending on the number of replays.

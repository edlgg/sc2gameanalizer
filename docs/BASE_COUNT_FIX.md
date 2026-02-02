# Base Count Bug Fix

## Problem
Base counts were stuck at 0, 1, or 2 across all games. Players typically take 3-5+ bases, but the system was only detecting a maximum of 2.

## Root Cause
In `src/snapshot.py`, the `_handle_unit_done()` method had logic that prevented counting multiple instances of the same building type:

```python
# OLD CODE (BUGGY):
if unit_type not in self.buildings or self.buildings[unit_type] == 0:
    self.buildings[unit_type] += 1
```

This meant:
- First Nexus completes → Count = 1 ✓
- Second Nexus completes → Check fails (Nexus already in dict with value 1) → Count stays at 1 ✗
- Third Nexus completes → Check fails → Count stays at 1 ✗

## Fix
Changed the building tracking logic:

1. **UnitBornEvent** (construction starts): Mark building as tracked but don't count it yet
2. **UnitDoneEvent** (construction completes): Always increment the count

```python
# NEW CODE (FIXED):
def _handle_unit_born(self, event):
    # For buildings, just mark as seen, don't count yet
    if hasattr(unit, 'is_building') and unit.is_building:
        if unit_id:
            self.alive_units[unit_id] = unit
        # Don't increment buildings count here

def _handle_unit_done(self, event):
    # Count buildings when they complete
    if hasattr(unit, 'is_building') and unit.is_building:
        self.buildings[unit_type] += 1  # Always increment!
```

## Impact
Now when players take multiple bases, they will all be counted correctly:
- First base completes → Count = 1 ✓
- Second base completes → Count = 2 ✓
- Third base completes → Count = 3 ✓
- etc.

## Action Required
**Existing replays need to be re-uploaded or reparsed** to benefit from this fix. The backend will automatically use the new logic for any newly uploaded replays.

## Verification
After re-uploading replays, check:
- Timeline charts should show base counts increasing to 3, 4, 5+ in longer games
- Milestone timeline should show "2nd Base", "3rd Base", "4th Base", "5th Base" markers
- Base comparison at key timestamps should show realistic values (not stuck at 1-2)

/**
 * Utility functions for formatting data
 */
import type { Snapshot, ChartDataPoint, KeyMoment, DeltaPoint } from '../types';

/** Snapshot with optional extra computed numeric fields (e.g. army_value_total). */
type SnapshotLike = Snapshot & Record<string, unknown>;

/**
 * Format seconds to MM:SS
 */
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds) % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Get race color for UI
 */
export function getRaceColor(race: string): string {
  const colors: Record<string, string> = {
    Terran: '#0ea5e9', // sky-500
    Protoss: '#eab308', // yellow-500
    Zerg: '#a855f7', // purple-500
  };
  return colors[race] || '#64748b';
}

/**
 * Convert snapshots to chart data points
 */
export function snapshotsToChartData(
  snapshots: Snapshot[],
  valueKey: keyof Snapshot
): ChartDataPoint[] {
  return snapshots.map((snap) => ({
    time: snap.game_time_seconds,
    timeFormatted: formatTime(snap.game_time_seconds),
    value: snap[valueKey] as number,
  }));
}

/**
 * Merge two snapshot arrays for comparison charts
 */
export function mergeSnapshotsForComparison(
  snapshots1: Snapshot[],
  snapshots2: Snapshot[],
  valueKey: keyof Snapshot
): ChartDataPoint[] {
  const timeMap = new Map<number, ChartDataPoint>();

  // Add snapshots from first game
  snapshots1.forEach((snap) => {
    timeMap.set(snap.game_time_seconds, {
      time: snap.game_time_seconds,
      timeFormatted: formatTime(snap.game_time_seconds),
      value: snap[valueKey] as number,
      value2: undefined,
    });
  });

  // Add snapshots from second game
  snapshots2.forEach((snap) => {
    const existing = timeMap.get(snap.game_time_seconds);
    if (existing) {
      existing.value2 = snap[valueKey] as number;
    } else {
      timeMap.set(snap.game_time_seconds, {
        time: snap.game_time_seconds,
        timeFormatted: formatTime(snap.game_time_seconds),
        value: undefined as any,
        value2: snap[valueKey] as number,
      });
    }
  });

  // Convert to array and sort by time
  return Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
}

/**
 * Calculate delta/difference between two snapshot series
 */
export function calculateDelta(
  userSnapshots: SnapshotLike[],
  proSnapshots: SnapshotLike[],
  valueKey: string,
  maxTime?: number // Optional: trim data to this time
): DeltaPoint[] {
  const deltaPoints: DeltaPoint[] = [];

  // Create time-indexed maps (filter by maxTime if specified)
  const userMap = new Map(
    userSnapshots
      .filter(s => !maxTime || s.game_time_seconds <= maxTime)
      .map((s) => [s.game_time_seconds, s[valueKey] as number])
  );
  const proMap = new Map(
    proSnapshots
      .filter(s => !maxTime || s.game_time_seconds <= maxTime)
      .map((s) => [s.game_time_seconds, s[valueKey] as number])
  );

  // Find common time points (filtered by maxTime)
  const allTimes = new Set([
    ...userSnapshots.filter(s => !maxTime || s.game_time_seconds <= maxTime).map((s) => s.game_time_seconds),
    ...proSnapshots.filter(s => !maxTime || s.game_time_seconds <= maxTime).map((s) => s.game_time_seconds),
  ]);

  allTimes.forEach((time) => {
    const userValue = userMap.get(time);
    const proValue = proMap.get(time);

    if (userValue !== undefined && proValue !== undefined) {
      const difference = userValue - proValue;
      // Handle pro=0 edge case: user having value when pro has 0 = 100% lead
      let percentageDifference: number;
      if (proValue === 0) {
        percentageDifference = userValue > 0 ? 100 : 0;
      } else {
        percentageDifference = ((userValue - proValue) / proValue) * 100;
      }

      deltaPoints.push({
        time,
        difference,
        percentageDifference,
        isAhead: difference > 0,
      });
    }
  });

  return deltaPoints.sort((a, b) => a.time - b.time);
}

/**
 * Extract key moments from comparison
 */
export function extractKeyMoments(
  userSnapshots: Snapshot[],
  proSnapshots: Snapshot[]
): KeyMoment[] {
  if (userSnapshots.length === 0 || proSnapshots.length === 0) return [];

  const moments: KeyMoment[] = [];
  // Generate timestamps every 3 min up to game end (dynamic, not hardcoded to 12min)
  const maxTime = Math.max(
    ...userSnapshots.map(s => s.game_time_seconds),
    ...proSnapshots.map(s => s.game_time_seconds)
  );
  const keyTimes: number[] = [];
  for (let t = 180; t <= maxTime; t += 180) {
    keyTimes.push(t);
  }

  keyTimes.forEach((targetTime) => {
    const userSnap = findClosestSnapshot(userSnapshots, targetTime);
    const proSnap = findClosestSnapshot(proSnapshots, targetTime);

    if (!userSnap || !proSnap) return;

    // Worker count comparison
    const workerDiff = Math.round(userSnap.worker_count) - Math.round(proSnap.worker_count);
    if (Math.abs(workerDiff) > 3) {
      moments.push({
        time: targetTime,
        title: `Workers at ${formatTime(targetTime)}`,
        description:
          workerDiff < 0
            ? `You were ${Math.abs(workerDiff)} workers behind`
            : `You were ${workerDiff} workers ahead`,
        userValue: Math.round(userSnap.worker_count),
        proValue: Math.round(proSnap.worker_count),
        difference: workerDiff,
        type: 'workers',
      });
    }

    // Army value comparison (after 6min)
    if (targetTime >= 360) {
      const userArmy = Math.round(userSnap.army_value_minerals + userSnap.army_value_gas);
      const proArmy = Math.round(proSnap.army_value_minerals + proSnap.army_value_gas);
      const armyDiff = userArmy - proArmy;

      if (Math.abs(armyDiff) > 500) {
        moments.push({
          time: targetTime,
          title: `Army Value at ${formatTime(targetTime)}`,
          description:
            armyDiff < 0
              ? `You were ${formatNumber(Math.abs(armyDiff))} resources behind`
              : `You were ${formatNumber(armyDiff)} resources ahead`,
          userValue: userArmy,
          proValue: proArmy,
          difference: armyDiff,
          type: 'army',
        });
      }
    }

    // Base count comparison (after 6min)
    if (targetTime >= 360) {
      const userBases = Math.round(userSnap.base_count);
      const proBases = Math.round(proSnap.base_count);
      const baseDiff = userBases - proBases;
      if (baseDiff !== 0) {
        moments.push({
          time: targetTime,
          title: `Bases at ${formatTime(targetTime)}`,
          description:
            baseDiff < 0
              ? `You were ${Math.abs(baseDiff)} ${Math.abs(baseDiff) === 1 ? 'base' : 'bases'} behind`
              : `You were ${baseDiff} ${baseDiff === 1 ? 'base' : 'bases'} ahead`,
          userValue: userBases,
          proValue: proBases,
          difference: baseDiff,
          type: 'bases',
        });
      }
    }
  });

  return moments;
}

/**
 * Find snapshot closest to target time
 */
export function findClosestSnapshot(snapshots: Snapshot[], targetTime: number, maxDistance: number = Infinity): Snapshot | null {
  if (snapshots.length === 0) return null;

  // Binary search — snapshots are sorted by game_time_seconds
  let lo = 0;
  let hi = snapshots.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (snapshots[mid].game_time_seconds < targetTime) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  // lo is now the first index >= targetTime; check lo and lo-1
  let closest: Snapshot;
  if (lo > 0) {
    const prev = snapshots[lo - 1];
    const curr = snapshots[lo];
    closest = Math.abs(prev.game_time_seconds - targetTime) <= Math.abs(curr.game_time_seconds - targetTime) ? prev : curr;
  } else {
    closest = snapshots[lo];
  }

  if (maxDistance !== Infinity && Math.abs(closest.game_time_seconds - targetTime) > maxDistance) {
    return null;
  }
  return closest;
}

/**
 * Calculate performance score (0-100)
 */
export function calculatePerformanceScore(userSnap: Snapshot, proSnap: Snapshot): number {
  let score = 100;

  // Worker efficiency (-20 points max)
  const workerRatio = userSnap.worker_count / Math.max(proSnap.worker_count, 1);
  score -= Math.max(0, 20 * (1 - workerRatio));

  // Army value (-30 points max)
  const userArmy = userSnap.army_value_minerals + userSnap.army_value_gas;
  const proArmy = proSnap.army_value_minerals + proSnap.army_value_gas;
  const armyRatio = userArmy / Math.max(proArmy, 1);
  score -= Math.max(0, 30 * (1 - armyRatio));

  // Resource efficiency (-25 points max)
  const efficiencyRatio = userSnap.spending_efficiency / Math.max(proSnap.spending_efficiency, 0.01);
  score -= Math.max(0, 25 * (1 - efficiencyRatio));

  // Base count (-25 points max)
  const baseRatio = userSnap.base_count / Math.max(proSnap.base_count, 1);
  score -= Math.max(0, 25 * (1 - baseRatio));

  return Math.max(0, Math.round(score));
}

/**
 * Calculate average snapshot values across multiple pro games
 */
export function calculateAverageSnapshots(proSnapshotSets: Snapshot[][]): Snapshot[] {
  if (proSnapshotSets.length === 0) return [];
  if (proSnapshotSets.length === 1) return proSnapshotSets[0];

  // Collect all unique timestamps
  const allTimes = new Set<number>();
  proSnapshotSets.forEach(snapshots => {
    snapshots.forEach(snap => allTimes.add(snap.game_time_seconds));
  });

  const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);

  // For each timestamp, average all numeric metrics across pro games
  return sortedTimes.map((time): Snapshot | null => {
    const snapshotsAtTime = proSnapshotSets
      .map(snapshots => findClosestSnapshot(snapshots, time, 30))
      .filter((snap): snap is Snapshot => snap !== null);

    if (snapshotsAtTime.length === 0) {
      // No game has data within 30s of this timestamp — skip it
      return null;
    }

    // Average all numeric fields
    const avgSnap: any = {
      game_time_seconds: time,
      player_number: 1,
      race: snapshotsAtTime[0].race,
    };

    // List of numeric fields to average
    const numericFields: (keyof Snapshot)[] = [
      'worker_count',
      'mineral_collection_rate',
      'gas_collection_rate',
      'unspent_minerals',
      'unspent_gas',
      'total_minerals_collected',
      'total_gas_collected',
      'army_value_minerals',
      'army_value_gas',
      'army_supply',
      'base_count',
      'vision_area',
      'units_killed_value',
      'units_lost_value',
      'resources_spent_minerals',
      'resources_spent_gas',
      'collection_efficiency',
      'spending_efficiency',
    ];

    numericFields.forEach(field => {
      const values = snapshotsAtTime.map(snap => snap[field] as number).filter(v => v !== undefined);
      avgSnap[field] = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
    });

    // Aggregate JSON fields (units, buildings, upgrades)

    // 1. Aggregate units - average counts across all pro games
    const allUnits = new Map<string, number[]>();
    snapshotsAtTime.forEach(snap => {
      let unitCounts: { [key: string]: number } = {};
      if (snap.units) {
        unitCounts = typeof snap.units === 'string' ? JSON.parse(snap.units) : snap.units;
      }
      Object.entries(unitCounts || {}).forEach(([unitName, count]) => {
        if (!allUnits.has(unitName)) {
          allUnits.set(unitName, []);
        }
        allUnits.get(unitName)!.push(count as number);
      });
    });

    const avgUnits: { [key: string]: number } = {};
    allUnits.forEach((counts, unitName) => {
      avgUnits[unitName] = Math.round(counts.reduce((sum, c) => sum + c, 0) / counts.length);
    });
    avgSnap.units = avgUnits;

    // 2. Aggregate buildings - average counts across all pro games
    const allBuildings = new Map<string, number[]>();
    snapshotsAtTime.forEach(snap => {
      let buildingCounts: { [key: string]: number } = {};
      if (snap.buildings) {
        buildingCounts = typeof snap.buildings === 'string' ? JSON.parse(snap.buildings) : snap.buildings;
      }
      Object.entries(buildingCounts || {}).forEach(([buildingName, count]) => {
        if (!allBuildings.has(buildingName)) {
          allBuildings.set(buildingName, []);
        }
        allBuildings.get(buildingName)!.push(count as number);
      });
    });

    const avgBuildings: { [key: string]: number } = {};
    allBuildings.forEach((counts, buildingName) => {
      avgBuildings[buildingName] = Math.round(counts.reduce((sum, c) => sum + c, 0) / counts.length);
    });
    avgSnap.buildings = avgBuildings;

    // 3. Aggregate upgrades - merge all unique upgrades from any pro game
    const allUpgrades = new Set<string>();
    snapshotsAtTime.forEach(snap => {
      let upgradesObj: Record<string, any> = {};
      if (snap.upgrades) {
        upgradesObj = typeof snap.upgrades === 'string' ? JSON.parse(snap.upgrades) : snap.upgrades;
      }
      // Upgrades are stored as {"UpgradeName": true}, extract keys
      Object.keys(upgradesObj || {}).forEach(upgrade => allUpgrades.add(upgrade));
    });

    // Convert back to Record<string, boolean> format for consistency
    const avgUpgrades: Record<string, boolean> = {};
    allUpgrades.forEach(upgrade => {
      avgUpgrades[upgrade] = true;
    });
    avgSnap.upgrades = avgUpgrades;

    return avgSnap as Snapshot;
  }).filter((snap): snap is Snapshot => snap !== null);
}

/**
 * Calculate min/max range for each metric at each timestamp
 */
export function calculateSnapshotRanges(
  proSnapshotSets: Snapshot[][]
): { min: Snapshot[], max: Snapshot[] } {
  if (proSnapshotSets.length === 0) return { min: [], max: [] };
  if (proSnapshotSets.length === 1) return { min: proSnapshotSets[0], max: proSnapshotSets[0] };

  // Collect all unique timestamps
  const allTimes = new Set<number>();
  proSnapshotSets.forEach(snapshots => {
    snapshots.forEach(snap => allTimes.add(snap.game_time_seconds));
  });

  const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);

  const minSnapshots: Snapshot[] = [];
  const maxSnapshots: Snapshot[] = [];

  // For each timestamp, find min/max across all pro games
  sortedTimes.forEach(time => {
    const snapshotsAtTime = proSnapshotSets
      .map(snapshots => findClosestSnapshot(snapshots, time, 30))
      .filter((snap): snap is Snapshot => snap !== null);

    if (snapshotsAtTime.length === 0) return;

    const numericFields: (keyof Snapshot)[] = [
      'worker_count',
      'mineral_collection_rate',
      'gas_collection_rate',
      'unspent_minerals',
      'unspent_gas',
      'total_minerals_collected',
      'total_gas_collected',
      'army_value_minerals',
      'army_value_gas',
      'army_supply',
      'base_count',
      'vision_area',
      'units_killed_value',
      'units_lost_value',
      'resources_spent_minerals',
      'resources_spent_gas',
      'collection_efficiency',
      'spending_efficiency',
    ];

    const minSnap: any = {
      game_time_seconds: time,
      player_number: 1,
      race: snapshotsAtTime[0].race,
    };

    const maxSnap: any = {
      game_time_seconds: time,
      player_number: 1,
      race: snapshotsAtTime[0].race,
    };

    numericFields.forEach(field => {
      const values = snapshotsAtTime.map(snap => snap[field] as number).filter(v => v !== undefined);
      if (values.length > 0) {
        minSnap[field] = Math.min(...values);
        maxSnap[field] = Math.max(...values);
      } else {
        minSnap[field] = 0;
        maxSnap[field] = 0;
      }
    });

    minSnapshots.push(minSnap as Snapshot);
    maxSnapshots.push(maxSnap as Snapshot);
  });

  return { min: minSnapshots, max: maxSnapshots };
}

/**
 * Merge user data with aggregated pro data for charts
 * Includes individual pro game values for low-level comparison
 */
export function mergeWithMultipleProGames(
  userSnapshots: SnapshotLike[],
  proSnapshotSets: SnapshotLike[][],
  proGameIds: number[],
  valueKey: string,
  maxTime?: number // Optional: trim data to this time
): ChartDataPoint[] {
  const avgProSnapshots = calculateAverageSnapshots(proSnapshotSets);
  const ranges = calculateSnapshotRanges(proSnapshotSets);

  const timeMap = new Map<number, ChartDataPoint>();

  // Cap to the user game's max time so we don't show 0-filled user data
  const userMaxTime = userSnapshots.length > 0
    ? Math.max(...userSnapshots.map(s => s.game_time_seconds))
    : 0;
  const effectiveMaxTime = maxTime ? Math.min(maxTime, userMaxTime) : userMaxTime;

  // Collect all unique timestamps (up to effectiveMaxTime)
  const allTimes = new Set<number>();
  userSnapshots.forEach(s => {
    if (s.game_time_seconds <= effectiveMaxTime) {
      allTimes.add(s.game_time_seconds);
    }
  });
  proSnapshotSets.forEach(snapshots => {
    snapshots.forEach(s => {
      if (s.game_time_seconds <= effectiveMaxTime) {
        allTimes.add(s.game_time_seconds);
      }
    });
  });

  // For each timestamp, collect all data
  Array.from(allTimes).forEach(time => {
    const userSnap = findClosestSnapshot(userSnapshots, time);
    const avgSnap = findClosestSnapshot(avgProSnapshots, time);
    const minSnap = ranges.min.find(s => s.game_time_seconds === time);
    const maxSnap = ranges.max.find(s => s.game_time_seconds === time);

    // Collect individual pro game values
    const proGames: { [gameId: string]: number } = {};
    proSnapshotSets.forEach((snapshots, index) => {
      const proSnap = findClosestSnapshot(snapshots, time);
      if (proSnap && proGameIds[index]) {
        proGames[`pro${proGameIds[index]}`] = proSnap[valueKey] as number;
      }
    });

    const avgValue = avgSnap ? avgSnap[valueKey] as number : undefined;

    timeMap.set(time, {
      time,
      timeFormatted: formatTime(time),
      value: userSnap ? userSnap[valueKey] as number : 0,
      value2: avgValue,  // Backward compatibility
      proAvg: avgValue,
      proMin: minSnap ? minSnap[valueKey] as number : undefined,
      proMax: maxSnap ? maxSnap[valueKey] as number : undefined,
      proGames: Object.keys(proGames).length > 0 ? proGames : undefined,
    });
  });

  // Convert to array and sort by time
  return Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
}

/**
 * Utility functions for formatting data
 */
import type { Snapshot, ChartDataPoint, KeyMoment, DeltaPoint } from '../types';

/**
 * Format seconds to MM:SS
 */
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
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
  userSnapshots: Snapshot[],
  proSnapshots: Snapshot[],
  valueKey: keyof Snapshot
): DeltaPoint[] {
  const deltaPoints: DeltaPoint[] = [];

  // Create time-indexed maps
  const userMap = new Map(
    userSnapshots.map((s) => [s.game_time_seconds, s[valueKey] as number])
  );
  const proMap = new Map(
    proSnapshots.map((s) => [s.game_time_seconds, s[valueKey] as number])
  );

  // Find common time points
  const allTimes = new Set([
    ...userSnapshots.map((s) => s.game_time_seconds),
    ...proSnapshots.map((s) => s.game_time_seconds),
  ]);

  allTimes.forEach((time) => {
    const userValue = userMap.get(time);
    const proValue = proMap.get(time);

    if (userValue !== undefined && proValue !== undefined && proValue !== 0) {
      const difference = userValue - proValue;
      const percentageDifference = ((userValue - proValue) / proValue) * 100;

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
  const moments: KeyMoment[] = [];
  const keyTimes = [180, 360, 540, 720]; // 3min, 6min, 9min, 12min

  keyTimes.forEach((targetTime) => {
    const userSnap = findClosestSnapshot(userSnapshots, targetTime);
    const proSnap = findClosestSnapshot(proSnapshots, targetTime);

    if (!userSnap || !proSnap) return;

    // Worker count comparison
    const workerDiff = userSnap.worker_count - proSnap.worker_count;
    if (Math.abs(workerDiff) > 3) {
      moments.push({
        time: targetTime,
        title: `Workers at ${formatTime(targetTime)}`,
        description:
          workerDiff < 0
            ? `You were ${Math.abs(workerDiff)} workers behind`
            : `You were ${workerDiff} workers ahead`,
        userValue: userSnap.worker_count,
        proValue: proSnap.worker_count,
        difference: workerDiff,
        type: 'workers',
      });
    }

    // Army value comparison (after 6min)
    if (targetTime >= 360) {
      const userArmy = userSnap.army_value_minerals + userSnap.army_value_gas;
      const proArmy = proSnap.army_value_minerals + proSnap.army_value_gas;
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
      const baseDiff = userSnap.base_count - proSnap.base_count;
      if (baseDiff !== 0) {
        moments.push({
          time: targetTime,
          title: `Bases at ${formatTime(targetTime)}`,
          description:
            baseDiff < 0
              ? `You were ${Math.abs(baseDiff)} ${Math.abs(baseDiff) === 1 ? 'base' : 'bases'} behind`
              : `You were ${baseDiff} ${baseDiff === 1 ? 'base' : 'bases'} ahead`,
          userValue: userSnap.base_count,
          proValue: proSnap.base_count,
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
function findClosestSnapshot(snapshots: Snapshot[], targetTime: number): Snapshot | null {
  if (snapshots.length === 0) return null;

  return snapshots.reduce((prev, curr) => {
    const prevDiff = Math.abs(prev.game_time_seconds - targetTime);
    const currDiff = Math.abs(curr.game_time_seconds - targetTime);
    return currDiff < prevDiff ? curr : prev;
  });
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

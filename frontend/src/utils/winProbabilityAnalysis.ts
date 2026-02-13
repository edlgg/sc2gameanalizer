import type { Snapshot } from '../types';
import { findClosestSnapshot } from './formatters';

export interface WinProbabilityPoint {
  time: number;
  probability: number;
}

export interface TurningPoint {
  time: number;
  probabilityBefore: number;
  probabilityAfter: number;
  change: number;
  description: string;
}

export interface WinProbabilityAnalysis {
  probabilities: WinProbabilityPoint[];
  turningPoints: TurningPoint[];
  finalProbability: number;
  gameType: 'dominant' | 'comeback' | 'close' | 'behind';
  avgProbability: number;
}

/**
 * Calculate win probability for a single snapshot using heuristic model
 * This is a simplified model based on key game metrics
 */
export function calculateWinProbability(
  userSnapshot: Snapshot,
  proAvgSnapshot: Snapshot
): number {
  // Early game (first 3 minutes): start near 50% as both players are equal
  if (userSnapshot.game_time_seconds < 180) {
    return 0.5;
  }

  // Feature weights (based on typical importance in SC2)
  const weights = {
    workers: 0.25,
    army: 0.30,
    bases: 0.15,
    spending_efficiency: 0.15,
    collection_efficiency: 0.10,
    combat_efficiency: 0.05,
  };

  // Normalize features (0-1 scale relative to pro)
  // Handle undefined/null values with defaults
  const features = {
    workers: normalizeMetric(
      userSnapshot.worker_count || 0,
      proAvgSnapshot.worker_count || 0,
      80
    ),
    army: normalizeMetric(
      (userSnapshot.army_value_minerals || 0) + (userSnapshot.army_value_gas || 0),
      (proAvgSnapshot.army_value_minerals || 0) + (proAvgSnapshot.army_value_gas || 0),
      15000
    ),
    bases: normalizeMetric(
      userSnapshot.base_count || 0,
      proAvgSnapshot.base_count || 0,
      5
    ),
    spending_efficiency: normalizeMetric(
      userSnapshot.spending_efficiency || 0,
      proAvgSnapshot.spending_efficiency || 0,
      1.0
    ),
    collection_efficiency: normalizeMetric(
      userSnapshot.collection_efficiency || 0,
      proAvgSnapshot.collection_efficiency || 0,
      1.0
    ),
    combat_efficiency: calculateCombatEfficiency(userSnapshot, proAvgSnapshot),
  };

  // Calculate weighted score (ensure no NaN)
  let score = 0;
  for (const [key, value] of Object.entries(features)) {
    const weight = weights[key as keyof typeof weights];
    if (isFinite(value) && isFinite(weight)) {
      score += value * weight;
    }
  }

  // Apply sigmoid function centered at 0.5 (50% probability)
  // score of 0.5 (matching pro) = 50% probability
  // score > 0.5 = higher probability, score < 0.5 = lower probability
  const probability = sigmoid((score - 0.5) * 6);

  // Ensure result is a valid probability
  return isFinite(probability) ? Math.max(0, Math.min(1, probability)) : 0.5;
}

/**
 * Normalize a metric relative to pro benchmark
 */
function normalizeMetric(userValue: number, proValue: number, maxValue: number): number {
  // Handle edge cases
  if (!isFinite(userValue) || !isFinite(proValue) || !isFinite(maxValue)) {
    return 0.5; // Default to neutral
  }

  if (proValue === 0) {
    // Fallback to absolute scaling
    return maxValue > 0 ? Math.max(0, Math.min(1, userValue / maxValue)) : 0.5;
  }

  // Calculate relative performance (user vs pro)
  const ratio = userValue / proValue;

  // Clamp between 0 and 2 (0 = terrible, 1 = match pro, 2 = double pro performance)
  const clampedRatio = Math.max(0, Math.min(2, ratio));

  // Convert to 0-1 scale where 1 = matching pro
  return clampedRatio / 2;
}

/**
 * Calculate combat efficiency from kill/death ratio
 */
function calculateCombatEfficiency(userSnapshot: Snapshot, proSnapshot: Snapshot): number {
  const userKilled = userSnapshot.units_killed_value || 0;
  const userLost = userSnapshot.units_lost_value || 1; // Avoid division by zero
  const userRatio = userKilled / userLost;

  const proKilled = proSnapshot.units_killed_value || 0;
  const proLost = proSnapshot.units_lost_value || 1;
  const proRatio = proKilled / proLost;

  if (proRatio === 0) return 0.5;

  const ratio = userRatio / proRatio;
  return Math.max(0, Math.min(1, ratio / 2));
}

/**
 * Sigmoid function for smooth probability curve
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Analyze win probability over time
 */
export function analyzeWinProbability(
  userSnapshots: Snapshot[],
  proAvgSnapshots: Snapshot[]
): WinProbabilityAnalysis {
  if (userSnapshots.length === 0 || proAvgSnapshots.length === 0) {
    return {
      probabilities: [],
      turningPoints: [],
      finalProbability: 0.5,
      gameType: 'close',
      avgProbability: 0.5,
    };
  }

  // Calculate probability at each timestamp
  const probabilities: WinProbabilityPoint[] = [];

  for (let i = 0; i < userSnapshots.length; i++) {
    const userSnap = userSnapshots[i];

    // Find closest pro snapshot by time
    const proSnap = findClosestSnapshot(proAvgSnapshots, userSnap.game_time_seconds);

    if (proSnap) {
      const probability = calculateWinProbability(userSnap, proSnap);
      probabilities.push({
        time: userSnap.game_time_seconds,
        probability,
      });
    }
  }

  // Detect turning points (significant probability swings)
  const turningPoints = detectTurningPoints(probabilities, userSnapshots, proAvgSnapshots);

  // Calculate final probability and average
  const finalProbability = probabilities.length > 0
    ? probabilities[probabilities.length - 1].probability
    : 0.5;

  const avgProbability = probabilities.length > 0
    ? probabilities.reduce((sum, p) => sum + p.probability, 0) / probabilities.length
    : 0.5;

  // Determine game type
  const gameType = classifyGameType(probabilities, avgProbability);

  return {
    probabilities,
    turningPoints,
    finalProbability,
    gameType,
    avgProbability,
  };
}

/**
 * Detect turning points (large probability swings)
 */
function detectTurningPoints(
  probabilities: WinProbabilityPoint[],
  userSnapshots: Snapshot[],
  proSnapshots: Snapshot[]
): TurningPoint[] {
  const turningPoints: TurningPoint[] = [];

  for (let i = 1; i < probabilities.length; i++) {
    const prev = probabilities[i - 1];
    const curr = probabilities[i];
    const change = curr.probability - prev.probability;

    // Threshold: 15% swing = significant
    if (Math.abs(change) > 0.15) {
      // Find matching user snapshots by time (probabilities may be shorter than userSnapshots)
      const prevUserSnap = findClosestSnapshot(userSnapshots, prev.time);
      const currUserSnap = findClosestSnapshot(userSnapshots, curr.time);

      if (!prevUserSnap || !currUserSnap) continue;

      // Find matching pro snapshot for comparison
      const proSnap = findClosestSnapshot(proSnapshots, curr.time);

      // Identify what caused the swing by comparing to pro
      const description = identifySwingCause(
        prevUserSnap,
        currUserSnap,
        change > 0,
        proSnap
      );

      turningPoints.push({
        time: curr.time,
        probabilityBefore: prev.probability,
        probabilityAfter: curr.probability,
        change,
        description,
      });
    }
  }

  // Limit to top 5 most significant turning points
  return turningPoints
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 5);
}

/**
 * Identify cause of probability swing with specific details
 * Compares user state to pro benchmark to explain WHY probability changed
 */
function identifySwingCause(
  prevSnap: Snapshot,
  currSnap: Snapshot,
  positive: boolean,
  proSnap?: Snapshot | null
): string {
  // Calculate changes between consecutive user snapshots
  const workerChange = (currSnap.worker_count || 0) - (prevSnap.worker_count || 0);
  const prevArmyValue = (prevSnap.army_value_minerals || 0) + (prevSnap.army_value_gas || 0);
  const currArmyValue = (currSnap.army_value_minerals || 0) + (currSnap.army_value_gas || 0);
  const armyChange = currArmyValue - prevArmyValue;
  const baseChange = (currSnap.base_count || 0) - (prevSnap.base_count || 0);
  const unitsLostChange = (currSnap.units_lost_value || 0) - (prevSnap.units_lost_value || 0);
  const unitsKilledChange = (currSnap.units_killed_value || 0) - (prevSnap.units_killed_value || 0);

  // Calculate gaps vs pro (if available)
  let workerGap = 0;
  let armyGap = 0;
  let baseGap = 0;

  if (proSnap) {
    const proWorkers = proSnap.worker_count || 0;
    const proArmy = (proSnap.army_value_minerals || 0) + (proSnap.army_value_gas || 0);
    const proBases = proSnap.base_count || 0;

    workerGap = (currSnap.worker_count || 0) - proWorkers;
    armyGap = currArmyValue - proArmy;
    baseGap = (currSnap.base_count || 0) - proBases;
  }

  // Collect all significant factors
  const causes: string[] = [];

  // Combat analysis (highest priority) - lowered thresholds
  if (unitsLostChange > 100) {
    causes.push(`Lost ${Math.round(unitsLostChange)} in combat`);
  }
  if (unitsKilledChange > 100) {
    causes.push(`Killed ${Math.round(unitsKilledChange)} enemy value`);
  }

  // Worker analysis - compare to pro
  if (proSnap) {
    if (workerGap < -5) {
      causes.push(`${Math.abs(workerGap)} workers behind pro`);
    } else if (workerGap > 3) {
      causes.push(`${workerGap} workers ahead of pro`);
    }
  } else if (Math.abs(workerChange) >= 2) {
    causes.push(workerChange > 0 ? `Built ${workerChange} workers` : `Lost ${Math.abs(workerChange)} workers`);
  }

  // Base analysis - compare to pro
  if (proSnap) {
    if (baseGap < 0) {
      causes.push(`${Math.abs(baseGap)} base${Math.abs(baseGap) > 1 ? 's' : ''} behind pro`);
    } else if (baseGap > 0) {
      causes.push(`${baseGap} base${baseGap > 1 ? 's' : ''} ahead of pro`);
    }
  } else if (baseChange !== 0) {
    causes.push(baseChange > 0 ? `Took expansion` : `Lost a base`);
  }

  // Army analysis - compare to pro
  if (proSnap) {
    if (armyGap < -1000) {
      causes.push(`Army ${Math.round(Math.abs(armyGap))} behind pro`);
    } else if (armyGap > 1000) {
      causes.push(`Army ${Math.round(armyGap)} ahead of pro`);
    }
  } else if (Math.abs(armyChange) > 500) {
    causes.push(armyChange > 0 ? `Army +${Math.round(armyChange)}` : `Army ${Math.round(armyChange)}`);
  }

  // Build the description
  if (causes.length === 0) {
    // Fallback with actual numbers
    const workers = currSnap.worker_count || 0;
    const bases = currSnap.base_count || 0;
    const army = Math.round(currArmyValue);

    if (positive) {
      return `Catching up (${workers} workers, ${bases} bases, ${army} army)`;
    } else {
      return `Falling behind (${workers} workers, ${bases} bases, ${army} army)`;
    }
  }

  // Return the most significant cause(s), limit to 2
  return causes.slice(0, 2).join(', ');
}

/**
 * Classify game type based on probability curve
 */
function classifyGameType(
  probabilities: WinProbabilityPoint[],
  avgProbability: number
): 'dominant' | 'comeback' | 'close' | 'behind' {
  if (probabilities.length === 0) return 'close';

  const finalProb = probabilities[probabilities.length - 1].probability;

  // Use minimum probability in first third of the game for comeback detection
  // (startProb at t=0 is always 0.5 due to flat early-game probability, so it can never trigger < 0.4)
  const firstThird = probabilities.slice(0, Math.ceil(probabilities.length / 3));
  const earlyMin = Math.min(...firstThird.map(p => p.probability));

  // Dominant: High final probability (>80%)
  if (finalProb > 0.8) {
    return 'dominant';
  }

  // Comeback: Was losing early (<40% at some point in first third), ended high (>60%)
  if (earlyMin < 0.4 && finalProb > 0.6) {
    return 'comeback';
  }

  // Behind: Low average probability (<40%)
  if (avgProbability < 0.4) {
    return 'behind';
  }

  // Close: Everything else (40-60% range)
  return 'close';
}

/**
 * Format time as MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds) % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

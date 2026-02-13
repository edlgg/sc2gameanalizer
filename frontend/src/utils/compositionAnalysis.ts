/**
 * Unit composition analysis utilities
 *
 * Processes snapshot unit data to analyze army composition, detect transitions,
 * and identify strategic decision points.
 */

import type { Snapshot } from '../types';
import { findClosestSnapshot } from './formatters';

/**
 * Worker unit names to exclude from composition analysis
 */
const WORKER_UNITS = ['SCV', 'Probe', 'Drone', 'MULE'];

/**
 * Support/non-combat units to optionally exclude
 */
const SUPPORT_UNITS = ['Overlord', 'Observer', 'Overseer'];

/**
 * Race-specific color palette for unit visualization
 */
export const UNIT_COLORS: { [key: string]: string } = {
  // Terran (Blues/Grays)
  Marine: '#0088ff',
  Marauder: '#0066cc',
  Reaper: '#4d4dff',
  Ghost: '#1a1a66',
  Hellion: '#ff6600',
  WidowMine: '#cc5200',
  SiegeTank: '#336699',
  Thor: '#4d79ff',
  Viking: '#0099ff',
  Medivac: '#66ccff',
  Liberator: '#0066ff',
  Raven: '#003366',
  Banshee: '#000099',
  Battlecruiser: '#4d4d99',

  // Protoss (Golds/Purples)
  Zealot: '#ffd700',
  Stalker: '#9370db',
  Sentry: '#ba55d3',
  Adept: '#daa520',
  HighTemplar: '#8b008b',
  DarkTemplar: '#4b0082',
  Immortal: '#ff8c00',
  Colossus: '#ffa500',
  Disruptor: '#ff6347',
  Archon: '#ff00ff',
  Phoenix: '#ffb6c1',
  VoidRay: '#9932cc',
  Oracle: '#da70d6',
  Tempest: '#8a2be2',
  Carrier: '#6a0dad',
  Mothership: '#9400d3',

  // Zerg (Greens/Purples)
  Zergling: '#7fff00',
  Baneling: '#32cd32',
  Roach: '#228b22',
  Ravager: '#2e8b57',
  Hydralisk: '#00ff7f',
  Lurker: '#006400',
  Infestor: '#8b4789',
  SwarmHost: '#9370db',
  Ultralisk: '#4b0082',
  Queen: '#ff69b4',
  Mutalisk: '#adff2f',
  Corruptor: '#9acd32',
  Viper: '#6b8e23',
  BroodLord: '#556b2f',

  // Default
  default: '#888888',
};

/**
 * Check if a unit is a worker
 */
export function isWorker(unitName: string): boolean {
  return WORKER_UNITS.includes(unitName);
}

/**
 * Check if a unit is a support unit
 */
export function isSupport(unitName: string): boolean {
  return SUPPORT_UNITS.includes(unitName);
}

/**
 * Get color for a unit type
 */
export function getUnitColor(unitName: string): string {
  return UNIT_COLORS[unitName] || UNIT_COLORS.default;
}

/**
 * Interface for processed composition data point
 */
export interface CompositionDataPoint {
  time: number;
  timeFormatted: string;
  units: { [unitName: string]: number };
  totalUnits: number;
}

/**
 * Extract and process unit composition from snapshots
 *
 * @param snapshots - Array of game snapshots
 * @param excludeWorkers - Whether to exclude workers from composition
 * @param excludeSupport - Whether to exclude support units
 * @returns Array of composition data points for charting
 */
export function extractUnitComposition(
  snapshots: Snapshot[],
  excludeWorkers: boolean = true,
  excludeSupport: boolean = false
): CompositionDataPoint[] {
  return snapshots.map(snapshot => {
    const units: { [unitName: string]: number } = {};
    let totalUnits = 0;

    // Parse units JSON (handle null/undefined)
    let unitCounts: { [key: string]: number } = {};
    if (snapshot.units) {
      unitCounts = typeof snapshot.units === 'string'
        ? JSON.parse(snapshot.units)
        : snapshot.units;
    }

    // Filter and aggregate units
    Object.entries(unitCounts || {}).forEach(([unitName, count]) => {
      const unitCount = count as number;

      // Apply filters
      if (excludeWorkers && isWorker(unitName)) return;
      if (excludeSupport && isSupport(unitName)) return;

      units[unitName] = unitCount;
      totalUnits += unitCount;
    });

    // Format time
    const minutes = Math.floor(snapshot.game_time_seconds / 60);
    const seconds = snapshot.game_time_seconds % 60;
    const timeFormatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    return {
      time: snapshot.game_time_seconds,
      timeFormatted,
      units,
      totalUnits,
    };
  });
}

/**
 * Get all unique unit types from composition data
 */
export function getUniqueUnits(compositionData: CompositionDataPoint[]): string[] {
  const unitSet = new Set<string>();

  compositionData.forEach(point => {
    Object.keys(point.units).forEach(unit => unitSet.add(unit));
  });

  return Array.from(unitSet).sort();
}

/**
 * Interface for composition transition
 */
export interface CompositionTransition {
  time: number;
  timeFormatted: string;
  fromComposition: { [unitName: string]: number };
  toComposition: { [unitName: string]: number };
  significantChanges: Array<{
    unitName: string;
    change: number;
    changePercent: number;
  }>;
  description: string;
}

/**
 * Detect significant composition transitions
 *
 * A transition is significant if:
 * - A unit type increases by >20% of total army
 * - A unit type decreases by >15% of total army
 * - Total composition shifts by >30%
 *
 * @param compositionData - Processed composition data
 * @param minInterval - Minimum seconds between detected transitions (default 120s)
 * @returns Array of detected transitions
 */
export function detectCompositionTransitions(
  compositionData: CompositionDataPoint[],
  minInterval: number = 120
): CompositionTransition[] {
  const transitions: CompositionTransition[] = [];
  const windowSize = 12; // 60 seconds at 5s intervals — sliding window for gradual transitions
  if (compositionData.length < windowSize + 1) return transitions;

  let lastTransitionTime = -minInterval;

  for (let i = windowSize; i < compositionData.length; i++) {
    const prev = compositionData[i - windowSize];
    const curr = compositionData[i];

    // Skip if too soon after last transition
    if (curr.time - lastTransitionTime < minInterval) continue;

    // Calculate percentage composition for both points
    const prevPercent = calculateCompositionPercentages(prev.units, prev.totalUnits);
    const currPercent = calculateCompositionPercentages(curr.units, curr.totalUnits);

    // Find significant changes
    const significantChanges: Array<{
      unitName: string;
      change: number;
      changePercent: number;
    }> = [];

    // Check all units that appear in either snapshot
    const allUnits = new Set([...Object.keys(prev.units), ...Object.keys(curr.units)]);

    allUnits.forEach(unitName => {
      const prevPct = prevPercent[unitName] || 0;
      const currPct = currPercent[unitName] || 0;
      const change = currPct - prevPct;

      // Significant if >15% change in composition
      if (Math.abs(change) > 15) {
        significantChanges.push({
          unitName,
          change: curr.units[unitName] - (prev.units[unitName] || 0),
          changePercent: change,
        });
      }
    });

    // If we have significant changes, record transition
    if (significantChanges.length > 0) {
      const description = generateTransitionDescription(significantChanges);

      transitions.push({
        time: curr.time,
        timeFormatted: curr.timeFormatted,
        fromComposition: prev.units,
        toComposition: curr.units,
        significantChanges,
        description,
      });

      lastTransitionTime = curr.time;
    }
  }

  return transitions;
}

/**
 * Calculate percentage composition
 */
function calculateCompositionPercentages(
  units: { [unitName: string]: number },
  total: number
): { [unitName: string]: number } {
  const percentages: { [unitName: string]: number } = {};

  if (total === 0) return percentages;

  Object.entries(units).forEach(([unitName, count]) => {
    percentages[unitName] = (count / total) * 100;
  });

  return percentages;
}

/**
 * Generate human-readable transition description
 */
function generateTransitionDescription(
  changes: Array<{ unitName: string; change: number; changePercent: number }>
): string {
  const increases = changes.filter(c => c.changePercent > 0);
  const decreases = changes.filter(c => c.changePercent < 0);

  const parts: string[] = [];

  if (increases.length > 0) {
    const topIncrease = increases.sort((a, b) => b.changePercent - a.changePercent)[0];
    parts.push(`+${topIncrease.unitName}s`);
  }

  if (decreases.length > 0) {
    const topDecrease = decreases.sort((a, b) => a.changePercent - b.changePercent)[0];
    parts.push(`-${topDecrease.unitName}s`);
  }

  return parts.join(', ');
}

/**
 * Interface for game milestone
 */
export interface GameMilestone {
  type: 'worker' | 'unit' | 'supply' | 'army_supply' | 'base' | 'building';
  description: string;
  time: number;
  timeFormatted: string;
  value: number | string;
  icon: string;
}

/**
 * Extract game milestones from snapshots
 */
export function extractMilestones(snapshots: Snapshot[]): GameMilestone[] {
  const milestones: GameMilestone[] = [];

  // Worker milestones to track (common benchmarks)
  const workerBenchmarks = [16, 22, 28, 44, 66, 80];
  const reachedWorkers = new Set<number>();

  // Supply milestones
  const supplyBenchmarks = [50, 100, 150, 200];
  const reachedSupply = new Set<number>();

  // Army supply milestones
  const armySupplyBenchmarks = [50, 100, 150];
  const reachedArmySupply = new Set<number>();

  // Base milestones
  const baseBenchmarks = [2, 3, 4, 5];
  const reachedBases = new Set<number>();

  // Key buildings to track (race-specific tech buildings)
  const keyBuildings: { [race: string]: string[] } = {
    'Terran': ['Barracks', 'Factory', 'Starport', 'CommandCenter', 'EngineeringBay'],
    'Protoss': ['Gateway', 'CyberneticsCore', 'Nexus', 'RoboticsFacility', 'Stargate', 'TwilightCouncil', 'Forge'],
    'Zerg': ['SpawningPool', 'Hatchery', 'RoachWarren', 'Lair', 'Spire', 'HydraliskDen', 'InfestationPit'],
  };
  const seenBuildings = new Set<string>();

  // Track first 5 unique unit types
  const seenUnits = new Set<string>();
  const firstUnits: Array<{ unit: string; time: number }> = [];

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds) % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  snapshots.forEach((snapshot) => {
    const time = snapshot.game_time_seconds;
    const timeFormatted = formatTime(time);

    // Worker milestones
    workerBenchmarks.forEach((benchmark) => {
      if (!reachedWorkers.has(benchmark) && snapshot.worker_count >= benchmark) {
        reachedWorkers.add(benchmark);
        milestones.push({
          type: 'worker',
          description: `${benchmark} Workers`,
          time,
          timeFormatted,
          value: benchmark,
          icon: '👷',
        });
      }
    });

    // Supply milestones
    const totalSupply = snapshot.army_supply + snapshot.worker_count;
    supplyBenchmarks.forEach((benchmark) => {
      if (!reachedSupply.has(benchmark) && totalSupply >= benchmark) {
        reachedSupply.add(benchmark);
        milestones.push({
          type: 'supply',
          description: `${benchmark} Supply`,
          time,
          timeFormatted,
          value: benchmark,
          icon: '📦',
        });
      }
    });

    // Army supply milestones
    armySupplyBenchmarks.forEach((benchmark) => {
      if (!reachedArmySupply.has(benchmark) && snapshot.army_supply >= benchmark) {
        reachedArmySupply.add(benchmark);
        milestones.push({
          type: 'army_supply',
          description: `${benchmark} Army Supply`,
          time,
          timeFormatted,
          value: benchmark,
          icon: '⚔️',
        });
      }
    });

    // Base milestones
    baseBenchmarks.forEach((benchmark) => {
      if (!reachedBases.has(benchmark) && snapshot.base_count >= benchmark) {
        reachedBases.add(benchmark);
        milestones.push({
          type: 'base',
          description: `${benchmark}${getOrdinalSuffix(benchmark)} Base`,
          time,
          timeFormatted,
          value: benchmark,
          icon: '🏠',
        });
      }
    });

    // Key buildings
    const race = snapshot.race;
    const raceBuildingsToTrack = keyBuildings[race] || [];
    let buildingCounts: { [key: string]: number } = {};
    if (snapshot.buildings) {
      buildingCounts = typeof snapshot.buildings === 'string'
        ? JSON.parse(snapshot.buildings)
        : snapshot.buildings;
    }

    Object.keys(buildingCounts || {}).forEach((buildingName) => {
      if (
        !seenBuildings.has(buildingName) &&
        raceBuildingsToTrack.includes(buildingName) &&
        buildingCounts[buildingName] > 0
      ) {
        seenBuildings.add(buildingName);
        milestones.push({
          type: 'building',
          description: `First ${buildingName}`,
          time,
          timeFormatted,
          value: buildingName,
          icon: '🏗️',
        });
      }
    });

    // First units (excluding workers and support)
    if (firstUnits.length < 5) {
      let unitCounts: { [key: string]: number } = {};
      if (snapshot.units) {
        unitCounts = typeof snapshot.units === 'string'
          ? JSON.parse(snapshot.units)
          : snapshot.units;
      }

      Object.keys(unitCounts || {}).forEach((unitName) => {
        if (
          !seenUnits.has(unitName) &&
          !isWorker(unitName) &&
          !isSupport(unitName) &&
          unitCounts[unitName] > 0
        ) {
          seenUnits.add(unitName);
          firstUnits.push({ unit: unitName, time });

          if (firstUnits.length <= 5) {
            milestones.push({
              type: 'unit',
              description: `First ${unitName}`,
              time,
              timeFormatted,
              value: unitName,
              icon: '🎖️',
            });
          }
        }
      });
    }
  });

  return milestones.sort((a, b) => a.time - b.time);
}

/**
 * Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

/**
 * Interface for decision point analysis
 */
export interface DecisionPoint {
  time: number;
  timeFormatted: string;
  decisionType: 'economy' | 'army' | 'expansion' | 'tech' | 'composition' | 'aggression';
  userChoice: {
    description: string;
    metric: string;
    value: number;
    details?: string;
  };
  proChoice: {
    description: string;
    metric: string;
    value: number;
    details?: string;
  };
  divergenceScore: number; // 0-100, how different the choices were
  outcome: {
    timeChecked: number;
    timeCheckedFormatted: string;
    userMetrics: { [key: string]: number };
    proMetrics: { [key: string]: number };
    winner: 'user' | 'pro' | 'neutral';
    analysis: string;
    confidence: 'high' | 'medium' | 'low';
  };
}

/**
 * Detect strategic decision points by comparing user and pro choices
 *
 * Enhanced to detect multiple decision types with adaptive thresholds:
 * - Economy vs Army decisions
 * - Expansion timing (greedy vs safe)
 * - Tech path choices (air vs ground, splash vs direct)
 * - Unit composition shifts
 * - Aggression timing (push vs macro)
 *
 * @param userSnapshots - User game snapshots
 * @param proSnapshotSets - Array of pro game snapshot arrays (for multi-game comparison)
 * @returns Array of detected decision points
 */
export function detectDecisionPoints(
  userSnapshots: Snapshot[],
  proSnapshotSets: Snapshot[][]
): DecisionPoint[] {
  if (userSnapshots.length === 0 || proSnapshotSets.length === 0) return [];

  const decisions: DecisionPoint[] = [];

  // Calculate game stage divisions (early/mid/late)
  const gameLength = userSnapshots[userSnapshots.length - 1].game_time_seconds;
  const earlyGame = Math.min(gameLength * 0.3, 300); // First 30% or 5min
  const midGame = Math.min(gameLength * 0.6, 600);   // Up to 60% or 10min

  // Scan through game at 30-second intervals
  for (let time = 120; time < gameLength - 150; time += 30) {
    const userSnap = findClosestSnapshot(userSnapshots, time, 30);
    if (!userSnap) continue;

    // Get snapshots from all pro games at this time
    const proSnaps = proSnapshotSets
      .map(snaps => findClosestSnapshot(snaps, time, 30))
      .filter(s => s !== null) as Snapshot[];

    if (proSnaps.length === 0) continue;

    // Calculate average pro metrics
    const avgProSnap = calculateAverageSnapshot(proSnaps);

    // Determine game stage for adaptive thresholds
    const stage = time < earlyGame ? 'early' : time < midGame ? 'mid' : 'late';

    // Check for various decision types
    const economyDecision = detectEconomyDecision(userSnap, avgProSnap, time, stage, userSnapshots, proSnapshotSets);
    if (economyDecision) decisions.push(economyDecision);

    const expansionDecision = detectExpansionDecision(userSnap, avgProSnap, time, stage, userSnapshots, proSnapshotSets);
    if (expansionDecision) decisions.push(expansionDecision);

    const techDecision = detectTechDecision(userSnap, avgProSnap, proSnaps, time, stage, userSnapshots, proSnapshotSets);
    if (techDecision) decisions.push(techDecision);

    const compositionDecision = detectCompositionDecision(userSnap, avgProSnap, proSnaps, time, stage, userSnapshots, proSnapshotSets);
    if (compositionDecision) decisions.push(compositionDecision);
  }

  // Deduplicate nearby decisions (keep most significant in 2-minute windows)
  const deduplicated = deduplicateDecisions(decisions, 120);

  return deduplicated;
}

/**
 * Calculate average snapshot from multiple pro games
 */
function calculateAverageSnapshot(snapshots: Snapshot[]): Snapshot {
  if (snapshots.length === 0) throw new Error('Cannot average empty snapshot array');
  if (snapshots.length === 1) return snapshots[0];

  const avg: any = { ...snapshots[0] };
  const numericFields = [
    'worker_count', 'army_supply', 'base_count',
    'army_value_minerals', 'army_value_gas',
    'unspent_minerals', 'unspent_gas',
    'mineral_collection_rate', 'gas_collection_rate',
    'total_minerals_collected', 'total_gas_collected',
  ];

  numericFields.forEach(field => {
    const sum = snapshots.reduce((acc, snap) => acc + (snap[field as keyof Snapshot] as number || 0), 0);
    avg[field] = Math.round(sum / snapshots.length);
  });

  return avg as Snapshot;
}

/**
 * Detect economy vs army decisions
 */
function detectEconomyDecision(
  userSnap: Snapshot,
  proSnap: Snapshot,
  time: number,
  stage: 'early' | 'mid' | 'late',
  userSnapshots: Snapshot[],
  proSnapshotSets: Snapshot[][]
): DecisionPoint | null {
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds) % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // Adaptive thresholds based on game stage
  const workerThreshold = stage === 'early' ? 5 : stage === 'mid' ? 8 : 10;
  const armyThreshold = stage === 'early' ? 500 : stage === 'mid' ? 1000 : 1500;

  const workerDiff = userSnap.worker_count - proSnap.worker_count;
  const userArmy = userSnap.army_value_minerals + userSnap.army_value_gas;
  const proArmy = proSnap.army_value_minerals + proSnap.army_value_gas;
  const armyDiff = userArmy - proArmy;

  // Check if divergence is significant
  if (Math.abs(workerDiff) < workerThreshold && Math.abs(armyDiff) < armyThreshold) {
    return null;
  }

  // Determine which is more significant
  const workerScore = Math.abs(workerDiff) / workerThreshold;
  const armyScore = Math.abs(armyDiff) / armyThreshold;

  if (workerScore < 1 && armyScore < 1) return null;

  // Check outcome 2 minutes later
  const outcomeTime = time + 120;
  const userOutcome = findClosestSnapshot(userSnapshots, outcomeTime, 30);
  const proOutcomes = proSnapshotSets
    .map(snaps => findClosestSnapshot(snaps, outcomeTime, 30))
    .filter(s => s !== null) as Snapshot[];

  if (!userOutcome || proOutcomes.length === 0) return null;

  const proOutcome = calculateAverageSnapshot(proOutcomes);

  // Determine decision type and evaluate
  let decisionType: 'economy' | 'army';
  let userDesc: string;
  let proDesc: string;
  let divergenceScore: number;

  if (workerScore > armyScore) {
    decisionType = 'economy';
    if (workerDiff > 0) {
      userDesc = `${Math.round(Math.abs(workerDiff))} more workers (greedy macro)`;
      proDesc = `${Math.round(Math.abs(workerDiff))} fewer workers (army focus)`;
    } else {
      userDesc = `${Math.round(Math.abs(workerDiff))} fewer workers (army focus)`;
      proDesc = `${Math.round(Math.abs(workerDiff))} more workers (greedy macro)`;
    }
    divergenceScore = Math.min(100, (Math.abs(workerDiff) / 15) * 100);
  } else {
    decisionType = 'army';
    if (armyDiff > 0) {
      userDesc = `+${Math.round(armyDiff / 100) * 100} army value (military pressure)`;
      proDesc = `Lighter army (economic focus)`;
    } else {
      userDesc = `Lighter army (economic focus)`;
      proDesc = `+${Math.round(Math.abs(armyDiff) / 100) * 100} army value (military pressure)`;
    }
    divergenceScore = Math.min(100, (Math.abs(armyDiff) / 2000) * 100);
  }

  // Evaluate outcome
  const userEconGrowth = (userOutcome.mineral_collection_rate - userSnap.mineral_collection_rate) +
                         (userOutcome.gas_collection_rate - userSnap.gas_collection_rate);
  const proEconGrowth = (proOutcome.mineral_collection_rate - proSnap.mineral_collection_rate) +
                        (proOutcome.gas_collection_rate - proSnap.gas_collection_rate);

  const userArmyGrowth = (userOutcome.army_value_minerals + userOutcome.army_value_gas) -
                         (userSnap.army_value_minerals + userSnap.army_value_gas);
  const proArmyGrowth = (proOutcome.army_value_minerals + proOutcome.army_value_gas) -
                        (proSnap.army_value_minerals + proSnap.army_value_gas);

  const userBaseGrowth = userOutcome.base_count - userSnap.base_count;
  const proBaseGrowth = proOutcome.base_count - proSnap.base_count;

  // Determine winner based on multiple factors
  let winner: 'user' | 'pro' | 'neutral';
  let analysis: string;
  let confidence: 'high' | 'medium' | 'low' = 'medium';

  const userPoints = (userEconGrowth > proEconGrowth * 1.2 ? 1 : 0) +
                     (userArmyGrowth > proArmyGrowth * 1.2 ? 1 : 0) +
                     (userBaseGrowth > proBaseGrowth ? 1 : 0);

  const proPoints = (proEconGrowth > userEconGrowth * 1.2 ? 1 : 0) +
                    (proArmyGrowth > userArmyGrowth * 1.2 ? 1 : 0) +
                    (proBaseGrowth > userBaseGrowth ? 1 : 0);

  if (userPoints > proPoints + 1) {
    winner = 'user';
    confidence = 'high';
    if (decisionType === 'economy') {
      analysis = `Economic advantage paid off: +${Math.round(userEconGrowth)} collection rate, enabled ${userBaseGrowth > 0 ? 'expansion' : 'stronger position'}`;
    } else {
      analysis = `Army pressure worked: secured map control and ${userArmyGrowth > proArmyGrowth * 1.5 ? 'maintained army lead' : 'transitioned well'}`;
    }
  } else if (proPoints > userPoints + 1) {
    winner = 'pro';
    confidence = 'high';
    if (decisionType === 'economy') {
      analysis = `Pro choice was safer: balanced approach led to ${proArmyGrowth > userArmyGrowth * 1.3 ? 'better army' : 'better position'}`;
    } else {
      analysis = `Pro economy proved better: grew faster (+${Math.round(proEconGrowth - userEconGrowth)} rate) while maintaining defense`;
    }
  } else {
    winner = 'neutral';
    confidence = 'low';
    analysis = `Both approaches viable in this situation - different paths to similar outcomes`;
  }

  return {
    time,
    timeFormatted: formatTime(time),
    decisionType,
    userChoice: {
      description: userDesc,
      metric: decisionType,
      value: decisionType === 'economy' ? userSnap.worker_count : userArmy,
    },
    proChoice: {
      description: proDesc,
      metric: decisionType,
      value: decisionType === 'economy' ? proSnap.worker_count : proArmy,
    },
    divergenceScore,
    outcome: {
      timeChecked: outcomeTime,
      timeCheckedFormatted: formatTime(outcomeTime),
      userMetrics: {
        economyGrowth: userEconGrowth,
        armyGrowth: userArmyGrowth,
        baseGrowth: userBaseGrowth,
      },
      proMetrics: {
        economyGrowth: proEconGrowth,
        armyGrowth: proArmyGrowth,
        baseGrowth: proBaseGrowth,
      },
      winner,
      analysis,
      confidence,
    },
  };
}

/**
 * Detect expansion timing decisions
 */
function detectExpansionDecision(
  userSnap: Snapshot,
  proSnap: Snapshot,
  time: number,
  stage: 'early' | 'mid' | 'late',
  userSnapshots: Snapshot[],
  proSnapshotSets: Snapshot[][]
): DecisionPoint | null {
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds) % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // Only check in early/mid game
  if (stage === 'late') return null;

  const baseDiff = userSnap.base_count - proSnap.base_count;

  // Only significant if 1+ base difference
  if (Math.abs(baseDiff) < 1) return null;

  // Check if this is a new divergence (wasn't true 30s ago)
  const prevUserSnap = findClosestSnapshot(userSnapshots, time - 30, 30);
  const prevProSnaps = proSnapshotSets
    .map(snaps => findClosestSnapshot(snaps, time - 30, 30))
    .filter(s => s !== null) as Snapshot[];

  if (prevUserSnap && prevProSnaps.length > 0) {
    const prevProSnap = calculateAverageSnapshot(prevProSnaps);
    const prevDiff = prevUserSnap.base_count - prevProSnap.base_count;
    if (Math.abs(prevDiff) >= 1) return null; // Already diverged, not a new decision
  }

  // Check outcome
  const outcomeTime = time + 120;
  const userOutcome = findClosestSnapshot(userSnapshots, outcomeTime, 30);
  const proOutcomes = proSnapshotSets
    .map(snaps => findClosestSnapshot(snaps, outcomeTime, 30))
    .filter(s => s !== null) as Snapshot[];

  if (!userOutcome || proOutcomes.length === 0) return null;

  const proOutcome = calculateAverageSnapshot(proOutcomes);

  let userDesc: string;
  let proDesc: string;

  if (baseDiff > 0) {
    userDesc = `Expanded to ${userSnap.base_count} bases (greedy)`;
    proDesc = `Stayed on ${proSnap.base_count} bases (safe)`;
  } else {
    userDesc = `Stayed on ${userSnap.base_count} bases (safe)`;
    proDesc = `Expanded to ${proSnap.base_count} bases (greedy)`;
  }

  // Evaluate outcome
  const userEconGrowth = userOutcome.mineral_collection_rate - userSnap.mineral_collection_rate;
  const proEconGrowth = proOutcome.mineral_collection_rate - proSnap.mineral_collection_rate;

  const userSurvived = userOutcome.worker_count > userSnap.worker_count * 0.7;
  const proSurvived = proOutcome.worker_count > proSnap.worker_count * 0.7;

  let winner: 'user' | 'pro' | 'neutral';
  let analysis: string;
  let confidence: 'high' | 'medium' | 'low';

  if (baseDiff > 0) {
    // User expanded
    if (userSurvived && userEconGrowth > proEconGrowth * 1.3) {
      winner = 'user';
      confidence = 'high';
      analysis = `Greedy expansion paid off: held it safely and economy grew +${Math.round(userEconGrowth)} collection rate`;
    } else if (!userSurvived || userOutcome.worker_count < userSnap.worker_count) {
      winner = 'pro';
      confidence = 'high';
      analysis = `Expansion was too greedy: lost workers and fell behind. Safe approach was better.`;
    } else {
      winner = 'neutral';
      confidence = 'medium';
      analysis = `Expansion held but growth modest. Both timings viable.`;
    }
  } else {
    // Pro expanded
    if (proSurvived && proEconGrowth > userEconGrowth * 1.3) {
      winner = 'pro';
      confidence = 'high';
      analysis = `Pro expansion timing better: safe enough to hold and grow economy faster (+${Math.round(proEconGrowth - userEconGrowth)})`;
    } else if (!proSurvived) {
      winner = 'user';
      confidence = 'high';
      analysis = `Conservative approach was correct: pro expansion was punished`;
    } else {
      winner = 'neutral';
      confidence = 'medium';
      analysis = `Both timings worked. Expansion window was safe.`;
    }
  }

  return {
    time,
    timeFormatted: formatTime(time),
    decisionType: 'expansion',
    userChoice: {
      description: userDesc,
      metric: 'bases',
      value: userSnap.base_count,
    },
    proChoice: {
      description: proDesc,
      metric: 'bases',
      value: proSnap.base_count,
    },
    divergenceScore: Math.abs(baseDiff) * 50,
    outcome: {
      timeChecked: outcomeTime,
      timeCheckedFormatted: formatTime(outcomeTime),
      userMetrics: {
        economyGrowth: userEconGrowth,
        survived: userSurvived ? 1 : 0,
        bases: userOutcome.base_count,
      },
      proMetrics: {
        economyGrowth: proEconGrowth,
        survived: proSurvived ? 1 : 0,
        bases: proOutcome.base_count,
      },
      winner,
      analysis,
      confidence,
    },
  };
}

/**
 * Detect tech path decisions
 */
function detectTechDecision(
  userSnap: Snapshot,
  proSnap: Snapshot,
  proSnaps: Snapshot[],
  time: number,
  stage: 'early' | 'mid' | 'late',
  userSnapshots: Snapshot[],
  proSnapshotSets: Snapshot[][]
): DecisionPoint | null {
  // Only check mid game when tech paths diverge
  if (stage !== 'mid') return null;

  // Parse buildings
  const userBuildings = typeof userSnap.buildings === 'string'
    ? JSON.parse(userSnap.buildings)
    : userSnap.buildings || {};

  const proBuildings: { [key: string]: number } = {};
  proSnaps.forEach(snap => {
    const buildings = typeof snap.buildings === 'string'
      ? JSON.parse(snap.buildings)
      : snap.buildings || {};
    Object.entries(buildings).forEach(([name, count]) => {
      proBuildings[name] = (proBuildings[name] || 0) + (count as number);
    });
  });
  Object.keys(proBuildings).forEach(key => {
    proBuildings[key] = Math.round(proBuildings[key] / proSnaps.length);
  });

  // Check for tech building divergences
  const techBuildings = [
    'Stargate', 'RoboticsFacility', 'TwilightCouncil', 'DarkShrine',
    'Starport', 'Factory', 'FusionCore',
    'Spire', 'GreaterSpire', 'UltraliskCavern', 'InfestationPit'
  ];

  let divergence = false;
  let userTech = '';
  let proTech = '';

  for (const building of techBuildings) {
    const userHas = (userBuildings[building] || 0) > 0;
    const proHas = (proBuildings[building] || 0) > 0;

    if (userHas && !proHas) {
      divergence = true;
      userTech = building;
      // Find what the pro actually built instead
      const proAltBuildings = techBuildings.filter(b => b !== building && (proBuildings[b] || 0) > 0);
      proTech = proAltBuildings.length > 0
        ? proAltBuildings[0]
        : 'no tech building';
    } else if (!userHas && proHas) {
      divergence = true;
      userTech = 'no ' + building;
      proTech = building;
    }
  }

  if (!divergence) return null;

  // Simple outcome: did the tech choice lead to more army value growth?
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds) % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const outcomeTime = time + 150;
  const userOutcome = findClosestSnapshot(userSnapshots, outcomeTime, 30);
  const proOutcomes = proSnapshotSets
    .map(snaps => findClosestSnapshot(snaps, outcomeTime, 30))
    .filter(s => s !== null) as Snapshot[];

  if (!userOutcome || proOutcomes.length === 0) return null;

  const proOutcome = calculateAverageSnapshot(proOutcomes);

  const userArmy = userSnap.army_value_minerals + userSnap.army_value_gas;
  const proArmy = proSnap.army_value_minerals + proSnap.army_value_gas;
  const userArmyGrowth = (userOutcome.army_value_minerals + userOutcome.army_value_gas) - userArmy;
  const proArmyGrowth = (proOutcome.army_value_minerals + proOutcome.army_value_gas) - proArmy;

  let winner: 'user' | 'pro' | 'neutral';
  let analysis: string;

  if (userArmyGrowth > proArmyGrowth * 1.3) {
    winner = 'user';
    analysis = `Tech path ${userTech} effective: army grew by ${Math.round(userArmyGrowth)}`;
  } else if (proArmyGrowth > userArmyGrowth * 1.3) {
    winner = 'pro';
    analysis = `Pro tech path ${proTech} stronger: army grew ${Math.round(proArmyGrowth - userArmyGrowth)} more`;
  } else {
    winner = 'neutral';
    analysis = `Different tech paths led to similar strength`;
  }

  return {
    time,
    timeFormatted: formatTime(time),
    decisionType: 'tech',
    userChoice: {
      description: `Tech: ${userTech}`,
      metric: 'tech',
      value: userArmy,
      details: userTech,
    },
    proChoice: {
      description: `Tech: ${proTech}`,
      metric: 'tech',
      value: proArmy,
      details: proTech,
    },
    divergenceScore: 70,
    outcome: {
      timeChecked: outcomeTime,
      timeCheckedFormatted: formatTime(outcomeTime),
      userMetrics: { armyGrowth: userArmyGrowth },
      proMetrics: { armyGrowth: proArmyGrowth },
      winner,
      analysis,
      confidence: 'medium',
    },
  };
}

/**
 * Detect composition decisions
 */
function detectCompositionDecision(
  userSnap: Snapshot,
  proSnap: Snapshot,
  proSnaps: Snapshot[],
  time: number,
  _stage: 'early' | 'mid' | 'late',
  userSnapshots: Snapshot[],
  proSnapshotSets: Snapshot[][]
): DecisionPoint | null {
  // Parse units
  const userUnits = typeof userSnap.units === 'string'
    ? JSON.parse(userSnap.units)
    : userSnap.units || {};

  const proUnits: { [key: string]: number } = {};
  proSnaps.forEach(snap => {
    const units = typeof snap.units === 'string'
      ? JSON.parse(snap.units)
      : snap.units || {};
    Object.entries(units).forEach(([name, count]) => {
      if (!isWorker(name) && !isSupport(name)) {
        proUnits[name] = (proUnits[name] || 0) + (count as number);
      }
    });
  });
  Object.keys(proUnits).forEach(key => {
    proUnits[key] = Math.round(proUnits[key] / proSnaps.length);
  });

  // Get main unit for user
  const userCombatUnits = Object.entries(userUnits)
    .filter(([name]) => !isWorker(name) && !isSupport(name))
    .sort(([, a], [, b]) => (b as number) - (a as number));

  const proCombatUnits = Object.entries(proUnits)
    .filter(([name]) => !isWorker(name) && !isSupport(name))
    .sort(([, a], [, b]) => (b as number) - (a as number));

  if (userCombatUnits.length === 0 || proCombatUnits.length === 0) return null;

  const userMainUnit = userCombatUnits[0][0];
  const proMainUnit = proCombatUnits[0][0];

  // Only flag if different main units
  if (userMainUnit === proMainUnit) return null;

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds) % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // Simple outcome check
  const outcomeTime = time + 120;
  const userOutcome = findClosestSnapshot(userSnapshots, outcomeTime, 30);
  const proOutcomes = proSnapshotSets
    .map(snaps => findClosestSnapshot(snaps, outcomeTime, 30))
    .filter(s => s !== null) as Snapshot[];

  if (!userOutcome || proOutcomes.length === 0) return null;

  const proOutcome = calculateAverageSnapshot(proOutcomes);

  const userArmyGrowth = (userOutcome.army_value_minerals + userOutcome.army_value_gas) -
                         (userSnap.army_value_minerals + userSnap.army_value_gas);
  const proArmyGrowth = (proOutcome.army_value_minerals + proOutcome.army_value_gas) -
                        (proSnap.army_value_minerals + proSnap.army_value_gas);

  let winner: 'user' | 'pro' | 'neutral';
  let analysis: string;

  if (userArmyGrowth > proArmyGrowth * 1.2) {
    winner = 'user';
    analysis = `${userMainUnit}-based composition scaled well (+${Math.round(userArmyGrowth)} army value)`;
  } else if (proArmyGrowth > userArmyGrowth * 1.2) {
    winner = 'pro';
    analysis = `Pro ${proMainUnit} composition stronger: better scaling (+${Math.round(proArmyGrowth - userArmyGrowth)})`;
  } else {
    winner = 'neutral';
    analysis = `Different unit choices, similar effectiveness`;
  }

  return {
    time,
    timeFormatted: formatTime(time),
    decisionType: 'composition',
    userChoice: {
      description: `${userMainUnit}-based army (${userCombatUnits[0][1]} units)`,
      metric: 'composition',
      value: userCombatUnits[0][1] as number,
      details: userMainUnit,
    },
    proChoice: {
      description: `${proMainUnit}-based army (${proCombatUnits[0][1]} units)`,
      metric: 'composition',
      value: proCombatUnits[0][1] as number,
      details: proMainUnit,
    },
    divergenceScore: 60,
    outcome: {
      timeChecked: outcomeTime,
      timeCheckedFormatted: formatTime(outcomeTime),
      userMetrics: { armyGrowth: userArmyGrowth },
      proMetrics: { armyGrowth: proArmyGrowth },
      winner,
      analysis,
      confidence: 'medium',
    },
  };
}

/**
 * Deduplicate nearby decisions - keep most significant in time windows
 */
function deduplicateDecisions(decisions: DecisionPoint[], windowSeconds: number): DecisionPoint[] {
  if (decisions.length === 0) return [];

  // Sort by time
  const sorted = [...decisions].sort((a, b) => a.time - b.time);

  const result: DecisionPoint[] = [];
  let windowStart = sorted[0].time;
  let windowDecisions: DecisionPoint[] = [];

  sorted.forEach(decision => {
    if (decision.time - windowStart < windowSeconds) {
      windowDecisions.push(decision);
    } else {
      // Choose best decision from window (highest divergence score)
      if (windowDecisions.length > 0) {
        const best = windowDecisions.sort((a, b) => b.divergenceScore - a.divergenceScore)[0];
        result.push(best);
      }
      windowStart = decision.time;
      windowDecisions = [decision];
    }
  });

  // Don't forget last window
  if (windowDecisions.length > 0) {
    const best = windowDecisions.sort((a, b) => b.divergenceScore - a.divergenceScore)[0];
    result.push(best);
  }

  return result;
}

import type { Snapshot } from '../types';

export interface SupplyBlock {
  startTime: number;
  endTime: number;
  duration: number;
  avgMineralRate: number;
  avgGasRate: number;
}

export interface SupplyBlockImpact {
  totalBlocks: number;
  totalBlockedTime: number;
  wastedMinerals: number;
  wastedGas: number;
  criticalBlocks: Array<{
    time: number;
    duration: number;
    reason: string;
  }>;
  ghostUnits: Array<{
    name: string;
    count: number;
    cost: { minerals: number; gas: number };
  }>;
}

/**
 * Estimate supply cap from race and game state
 * Note: This is an estimation since supply_cap is not directly tracked in snapshots
 */
function estimateSupplyCap(snapshot: Snapshot, race: string): number {
  // Starting supply by race
  const startingSupply = {
    'Zerg': 6, // Hatchery only; Overlords counted in supply buildings
    'Terran': 15,
    'Protoss': 15,
  }[race] || 15;

  // Parse buildings JSON
  const buildingsRaw = snapshot.buildings;
  let buildings: Record<string, number> = {};

  if (typeof buildingsRaw === 'string') {
    try {
      buildings = JSON.parse(buildingsRaw);
    } catch {
      buildings = {};
    }
  } else if (typeof buildingsRaw === 'object' && buildingsRaw !== null) {
    buildings = buildingsRaw as Record<string, number>;
  }

  // Parse units JSON (needed for Zerg Overlords)
  const unitsRaw = snapshot.units;
  let units: Record<string, number> = {};

  if (typeof unitsRaw === 'string') {
    try {
      units = JSON.parse(unitsRaw);
    } catch {
      units = {};
    }
  } else if (typeof unitsRaw === 'object' && unitsRaw !== null) {
    units = unitsRaw as Record<string, number>;
  }

  // Calculate supply provided by structures
  let supplyProvided = 0;

  if (race === 'Zerg') {
    // Overlords are in units, not buildings
    const overlords = units['Overlord'] || 0;
    supplyProvided = overlords * 8;
    // Additional Hatcheries/Lairs/Hives provide 6 supply each
    const hatches = (buildings['Hatchery'] || 0) + (buildings['Lair'] || 0) + (buildings['Hive'] || 0);
    supplyProvided += Math.max(0, hatches - 1) * 6;
  } else if (race === 'Terran') {
    const depots = (buildings['SupplyDepot'] || 0) + (buildings['SupplyDepotLowered'] || 0);
    supplyProvided = depots * 8;
    // Additional Command Centers/Orbital Commands/Planetary Fortresses provide 15 supply each
    const ccs = (buildings['CommandCenter'] || 0) + (buildings['OrbitalCommand'] || 0) + (buildings['PlanetaryFortress'] || 0);
    supplyProvided += Math.max(0, ccs - 1) * 15;
  } else if (race === 'Protoss') {
    const pylons = buildings['Pylon'] || 0;
    supplyProvided = pylons * 8;
    // Additional Nexuses provide 15 supply each
    const nexuses = buildings['Nexus'] || 0;
    supplyProvided += Math.max(0, nexuses - 1) * 15;
  }

  return startingSupply + supplyProvided;
}

/**
 * Detect supply block periods from snapshots
 */
export function detectSupplyBlocks(snapshots: Snapshot[], race: string): SupplyBlock[] {
  const blocks: SupplyBlock[] = [];
  let blockStart: number | null = null;
  let blockStartIndex: number | null = null;

  for (let i = 0; i < snapshots.length; i++) {
    const snap = snapshots[i];

    // Skip early game (first 2 minutes)
    if (snap.game_time_seconds < 120) {
      continue;
    }

    const estimatedCap = estimateSupplyCap(snap, race);

    // Calculate TOTAL supply used (army + workers)
    const armySupply = snap.army_supply || 0;
    const workerCount = snap.worker_count || 0;
    const totalSupply = armySupply + workerCount;

    // Only check for blocks if we have meaningful supply usage (>20 total supply)
    if (totalSupply < 20) {
      continue;
    }

    // Flag as blocked if total supply is at or very close to cap (within 1)
    const isBlocked = totalSupply >= estimatedCap - 1 && totalSupply > 0;

    if (isBlocked && blockStart === null) {
      // Block started
      blockStart = snap.game_time_seconds;
      blockStartIndex = i;
    } else if (!isBlocked && blockStart !== null && blockStartIndex !== null) {
      // Block ended
      const duration = snap.game_time_seconds - blockStart;

      // Only count blocks >= 10 seconds as significant
      if (duration >= 10) {
        // Calculate average collection rates during block
        const blockSnapshots = snapshots.slice(blockStartIndex, i + 1);
        const avgMineralRate =
          blockSnapshots.reduce((sum, s) => sum + (s.mineral_collection_rate || 0), 0) /
          blockSnapshots.length;
        const avgGasRate =
          blockSnapshots.reduce((sum, s) => sum + (s.gas_collection_rate || 0), 0) /
          blockSnapshots.length;

        blocks.push({
          startTime: blockStart,
          endTime: snap.game_time_seconds,
          duration,
          avgMineralRate,
          avgGasRate,
        });
      }

      blockStart = null;
      blockStartIndex = null;
    }
  }

  return blocks;
}

/**
 * Calculate economic impact of supply blocks
 *
 * When supply blocked, workers mine normally but you can't build units.
 * The waste is LOST PRODUCTION CYCLES, not lost mining.
 *
 * Calculation: How many workers could you have continuously produced?
 * = (total_blocked_time / worker_build_time) * worker_cost
 */
export function calculateBlockCost(blocks: SupplyBlock[]): {
  totalWastedMinerals: number;
  totalWastedGas: number;
} {
  const totalBlockedTime = blocks.reduce((sum, block) => sum + block.duration, 0);

  // Handle edge case: no blocks detected
  if (totalBlockedTime === 0 || blocks.length === 0) {
    return { totalWastedMinerals: 0, totalWastedGas: 0 };
  }

  // Average worker build time across races:
  // - Zerg: ~12s (larva-limited)
  // - Terran: ~17s (SCV from Command Center)
  // - Protoss: ~17s (Probe from Nexus)
  // Use 17s as a reasonable average
  const workerBuildTime = 17;
  const workerMineralCost = 50;

  // Calculate how many workers could have been made with continuous production
  const missedWorkers = totalBlockedTime / workerBuildTime;
  const totalWastedMinerals = Math.round(missedWorkers * workerMineralCost);

  // Gas waste is harder to estimate since workers themselves don't cost gas
  // But supply blocks also prevent building gas units
  // Use a simplified heuristic: ~30% of mineral opportunity cost
  const totalWastedGas = Math.round(totalWastedMinerals * 0.3);

  return { totalWastedMinerals, totalWastedGas };
}

/**
 * Convert wasted resources to "ghost units" the player could have built
 */
export function calculateGhostUnits(
  minerals: number,
  gas: number,
  race: string
): Array<{ name: string; count: number; cost: { minerals: number; gas: number } }> {
  const UNIT_COSTS: Record<string, Array<{ name: string; minerals: number; gas: number }>> = {
    'Terran': [
      { name: 'Marine', minerals: 50, gas: 0 },
      { name: 'Marauder', minerals: 100, gas: 25 },
      { name: 'Siege Tank', minerals: 150, gas: 125 },
      { name: 'Medivac', minerals: 100, gas: 100 },
    ],
    'Protoss': [
      { name: 'Zealot', minerals: 100, gas: 0 },
      { name: 'Stalker', minerals: 125, gas: 50 },
      { name: 'Immortal', minerals: 275, gas: 100 },
      { name: 'Sentry', minerals: 50, gas: 100 },
    ],
    'Zerg': [
      { name: 'Zergling', minerals: 25, gas: 0 }, // per individual Zergling (spawns in pairs for 50)
      { name: 'Roach', minerals: 75, gas: 25 },
      { name: 'Hydralisk', minerals: 100, gas: 50 },
      { name: 'Mutalisk', minerals: 100, gas: 100 },
    ],
  };

  const units = UNIT_COSTS[race] || UNIT_COSTS['Terran'];

  return units.map(unit => {
    let count: number;

    if (unit.gas === 0) {
      // Mineral-only unit
      count = Math.floor(minerals / unit.minerals);
    } else if (unit.minerals === 0) {
      // Gas-only unit (rare)
      count = Math.floor(gas / unit.gas);
    } else {
      // Both minerals and gas required
      count = Math.floor(Math.min(minerals / unit.minerals, gas / unit.gas));
    }

    return {
      name: unit.name,
      count,
      cost: {
        minerals: unit.minerals,
        gas: unit.gas,
      },
    };
  }).filter(unit => unit.count > 0);
}

/**
 * Identify critical supply blocks that occurred during important game moments
 */
export function identifyCriticalBlocks(blocks: SupplyBlock[]): Array<{
  time: number;
  duration: number;
  reason: string;
}> {
  const TIMING_WINDOWS = [
    { time: 270, label: '4:30 timing window', range: 30 },
    { time: 420, label: '7:00 timing window', range: 30 },
    { time: 480, label: '8:00 attack timing', range: 30 },
    { time: 600, label: '10:00 major engagement', range: 30 },
  ];

  const criticalBlocks: Array<{
    time: number;
    duration: number;
    reason: string;
  }> = [];

  blocks.forEach(block => {
    // Check if block overlaps with critical timing windows
    for (const window of TIMING_WINDOWS) {
      const blockOverlap =
        (block.startTime <= window.time + window.range) &&
        (block.endTime >= window.time - window.range);

      if (blockOverlap) {
        criticalBlocks.push({
          time: block.startTime,
          duration: block.duration,
          reason: `Blocked during ${window.label}`,
        });
        break; // Only count once per block
      }
    }

    // Also flag very long blocks (>60 seconds) as critical
    if (block.duration > 60) {
      const alreadyAdded = criticalBlocks.some(cb => cb.time === block.startTime);
      if (!alreadyAdded) {
        criticalBlocks.push({
          time: block.startTime,
          duration: block.duration,
          reason: `Extremely long supply block (${Math.round(block.duration)}s)`,
        });
      }
    }
  });

  return criticalBlocks;
}

/**
 * Analyze supply blocks and calculate full impact
 */
export function analyzeSupplyBlocks(snapshots: Snapshot[], race: string): SupplyBlockImpact {
  const blocks = detectSupplyBlocks(snapshots, race);
  const { totalWastedMinerals, totalWastedGas } = calculateBlockCost(blocks);
  const criticalBlocks = identifyCriticalBlocks(blocks);
  const ghostUnits = calculateGhostUnits(totalWastedMinerals, totalWastedGas, race);

  const totalBlockedTime = blocks.reduce((sum, block) => sum + block.duration, 0);

  return {
    totalBlocks: blocks.length,
    totalBlockedTime,
    wastedMinerals: totalWastedMinerals,
    wastedGas: totalWastedGas,
    criticalBlocks,
    ghostUnits,
  };
}

/**
 * Compare supply block performance with pro games
 */
export function compareSupplyBlocks(
  userBlocks: SupplyBlockImpact,
  proBlocksList: SupplyBlockImpact[]
): {
  avgProBlockedTime: number;
  avgProBlocks: number;
  userBlocksDiff: number;
  userTimeDiff: number;
  status: 'excellent' | 'good' | 'average' | 'poor';
} {
  if (proBlocksList.length === 0) {
    return {
      avgProBlockedTime: 0,
      avgProBlocks: 0,
      userBlocksDiff: 0,
      userTimeDiff: 0,
      status: 'average',
    };
  }

  const avgProBlockedTime =
    proBlocksList.reduce((sum, pb) => sum + pb.totalBlockedTime, 0) / proBlocksList.length;
  const avgProBlocks =
    proBlocksList.reduce((sum, pb) => sum + pb.totalBlocks, 0) / proBlocksList.length;

  const userTimeDiff = userBlocks.totalBlockedTime - avgProBlockedTime;
  const userBlocksDiff = userBlocks.totalBlocks - avgProBlocks;

  // Determine status based on time difference
  let status: 'excellent' | 'good' | 'average' | 'poor';
  if (userTimeDiff < -10) status = 'excellent'; // 10s better than pros
  else if (userTimeDiff < 10) status = 'good'; // Within 10s of pros
  else if (userTimeDiff < 30) status = 'average'; // Within 30s of pros
  else status = 'poor'; // More than 30s blocked compared to pros

  return {
    avgProBlockedTime,
    avgProBlocks,
    userBlocksDiff,
    userTimeDiff,
    status,
  };
}

/**
 * Format seconds as MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds) % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

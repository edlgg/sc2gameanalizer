import type { Snapshot } from '../types';

export interface ResourceFlowData {
  nodes: Array<{
    id: string;
    label: string;
    value: number;
    color?: string;
  }>;
  links: Array<{
    source: string;
    target: string;
    value: number;
  }>;
  metrics: {
    tradeEfficiency: number;
    resourcesIntoArmy: number;
    resourcesIntoEconomy: number;
    resourcesIntoTech: number;
    armySurvivalRate: number;
    armyLossRate: number; // % of army production that was lost in combat
  };
}

/**
 * Calculate cumulative spending by category from snapshots
 * Uses total_collected and current assets to estimate spending breakdown
 */
export function calculateSpendingBreakdown(snapshots: Snapshot[]): {
  economySpent: number;
  armySpent: number;
  techSpent: number;
  totalSpent: number;
} {
  if (snapshots.length === 0) {
    return { economySpent: 0, armySpent: 0, techSpent: 0, totalSpent: 0 };
  }

  const lastSnap = snapshots[snapshots.length - 1];
  const firstSnap = snapshots[0];

  // Calculate total resources spent (collected - unspent - current assets)
  const totalCollected = lastSnap.total_minerals_collected + lastSnap.total_gas_collected;
  const currentAssets = (lastSnap.army_value_minerals || 0) + (lastSnap.army_value_gas || 0);
  const unspent = (lastSnap.unspent_minerals || 0) + (lastSnap.unspent_gas || 0);
  const totalSpent = Math.max(totalCollected - unspent, 0);

  // Estimate economy spending from worker production
  const workerGrowth = Math.max(lastSnap.worker_count - (firstSnap?.worker_count || 12), 0);
  const workerCost = workerGrowth * 50; // 50 minerals per worker

  // Estimate expansion spending from base count
  const baseGrowth = Math.max(lastSnap.base_count - (firstSnap?.base_count || 1), 0);
  const race = lastSnap.race;
  const expansionCost = baseGrowth * (race === 'Zerg' ? 300 : 400); // Hatchery=300, Nexus/CC=400

  const economySpent = workerCost + expansionCost;

  // Estimate tech spending (buildings + upgrades)
  // Count tech buildings from buildings JSON
  let techBuildingCount = 0;
  try {
    const buildings = typeof lastSnap.buildings === 'string'
      ? JSON.parse(lastSnap.buildings)
      : lastSnap.buildings || {};

    // Tech buildings typically cost 150-200 each
    const techBuildings = ['Gateway', 'RoboticsFacility', 'Stargate', 'Factory', 'Starport',
                          'Barracks', 'SpawningPool', 'RoachWarren', 'Spire'];
    for (const building of techBuildings) {
      if (buildings[building]) {
        techBuildingCount += buildings[building];
      }
    }
  } catch {
    // Ignore parsing errors
  }

  // Estimate upgrades (assume 10% of tech spending)
  const techSpent = Math.min(techBuildingCount * 150 * 1.1, totalSpent * 0.20);

  // Army spending is what's left + what was lost + current army
  const unitsLostValue = (lastSnap.units_lost_value || 0);
  const armySpent = Math.max(currentAssets + unitsLostValue, 0);

  // Validate totals don't exceed collected
  const estimatedTotal = economySpent + armySpent + techSpent;

  // If estimate exceeds collected, normalize (avoid division by zero)
  if (estimatedTotal > totalCollected && estimatedTotal > 0) {
    const ratio = totalCollected / estimatedTotal;
    return {
      economySpent: economySpent * ratio,
      armySpent: armySpent * ratio,
      techSpent: techSpent * ratio,
      totalSpent: totalCollected,
    };
  }

  // Total spent should never exceed what was collected
  return {
    economySpent,
    armySpent,
    techSpent,
    totalSpent: Math.min(economySpent + armySpent + techSpent, totalCollected),
  };
}

/**
 * Analyze resource flow from collection through spending to combat outcomes
 */
export function analyzeResourceFlow(snapshots: Snapshot[]): ResourceFlowData {
  if (snapshots.length === 0) {
    return {
      nodes: [],
      links: [],
      metrics: {
        tradeEfficiency: 0,
        resourcesIntoArmy: 0,
        resourcesIntoEconomy: 0,
        resourcesIntoTech: 0,
        armySurvivalRate: 0,
        armyLossRate: 0,
      },
    };
  }

  const lastSnap = snapshots[snapshots.length - 1];

  const totalCollected = lastSnap.total_minerals_collected + lastSnap.total_gas_collected;

  // Calculate spending by category
  const { economySpent, armySpent, techSpent, totalSpent } = calculateSpendingBreakdown(snapshots);

  // Combat outcomes
  const unitsLost = lastSnap.units_lost_value || 0;
  const unitsKilled = lastSnap.units_killed_value || 0;
  const armySurvived = (lastSnap.army_value_minerals || 0) + (lastSnap.army_value_gas || 0);

  // Calculate trade efficiency (avoid division by zero)
  const tradeEfficiency = unitsLost > 0 ? unitsKilled / unitsLost : (unitsKilled > 0 ? 9999 : 0);

  // Build Sankey data structure
  // Note: unspent resources go back to collection pool
  const unspent = (lastSnap.unspent_minerals || 0) + (lastSnap.unspent_gas || 0);

  const nodes = [
    { id: 'collected', label: 'Resources Collected', value: totalCollected },
    { id: 'economy', label: 'Economy', value: economySpent },
    { id: 'army', label: 'Army Production', value: armySpent },
    { id: 'tech', label: 'Tech & Upgrades', value: techSpent },
    { id: 'lost', label: 'Units Lost', value: unitsLost },
    { id: 'killed', label: 'Enemy Killed', value: unitsKilled },
    { id: 'survived', label: 'Army Survived', value: armySurvived },
    { id: 'unspent', label: 'Unspent', value: unspent },
  ];

  const links = [
    { source: 'collected', target: 'economy', value: economySpent },
    { source: 'collected', target: 'army', value: armySpent },
    { source: 'collected', target: 'tech', value: techSpent },
    { source: 'collected', target: 'unspent', value: unspent },
    { source: 'army', target: 'lost', value: unitsLost },
    { source: 'army', target: 'survived', value: armySurvived },
  ];

  // Add "Other" category for unaccounted resources so the Sankey diagram balances
  const unspentTotal = unspent;
  const accounted = economySpent + armySpent + techSpent + unspentTotal;
  const other = Math.max(0, totalCollected - accounted);
  if (other > 0) {
    nodes.push({ id: 'other', label: 'Other', value: other });
    links.push({ source: 'collected', target: 'other', value: other });
  }

  // Filter out zero-value links
  const validLinks = links.filter(link => link.value > 0);

  // Calculate army loss rate: what % of army production was lost
  // Formula: unitsLost / (armySurvived + unitsLost) * 100
  const totalArmyProduced = armySurvived + unitsLost;
  const armyLossRate = totalArmyProduced > 0
    ? Math.min((unitsLost / totalArmyProduced) * 100, 100)
    : 0;

  // Calculate metrics as percentages (ensure no NaN/Infinity)
  const metrics = {
    tradeEfficiency: isFinite(tradeEfficiency) ? tradeEfficiency : 0,
    resourcesIntoArmy: totalSpent > 0 ? Math.min((armySpent / totalSpent) * 100, 100) : 0,
    resourcesIntoEconomy: totalSpent > 0 ? Math.min((economySpent / totalSpent) * 100, 100) : 0,
    resourcesIntoTech: totalSpent > 0 ? Math.min((techSpent / totalSpent) * 100, 100) : 0,
    armySurvivalRate: armySpent > 0 ? Math.min((armySurvived / armySpent) * 100, 100) : 0,
    armyLossRate,
  };

  return { nodes, links: validLinks, metrics };
}

/**
 * Compare resource efficiency between user and pro games
 */
export function compareResourceEfficiency(
  userFlow: ResourceFlowData,
  proFlows: ResourceFlowData[]
): {
  tradeEfficiencyDiff: number;
  armySpendingDiff: number;
  survivalRateDiff: number;
  armyLossRateDiff: number;
  avgProLossRate: number;
  status: 'excellent' | 'good' | 'average' | 'poor';
  hasTradeData: boolean;
} {
  if (proFlows.length === 0) {
    return {
      tradeEfficiencyDiff: 0,
      armySpendingDiff: 0,
      survivalRateDiff: 0,
      armyLossRateDiff: 0,
      avgProLossRate: 0,
      status: 'average',
      hasTradeData: false,
    };
  }

  // Calculate pro averages (filter out 0 trade efficiency as it means no combat data)
  const proFlowsWithTrades = proFlows.filter(f => f.metrics.tradeEfficiency > 0);
  const avgProTradeEff = proFlowsWithTrades.length > 0
    ? proFlowsWithTrades.reduce((sum, f) => sum + f.metrics.tradeEfficiency, 0) / proFlowsWithTrades.length
    : 0;

  const avgProArmySpend = proFlows.reduce((sum, f) => sum + f.metrics.resourcesIntoArmy, 0) / proFlows.length;
  const avgProSurvivalRate = proFlows.reduce((sum, f) => sum + f.metrics.armySurvivalRate, 0) / proFlows.length;
  const avgProLossRate = proFlows.reduce((sum, f) => sum + f.metrics.armyLossRate, 0) / proFlows.length;

  // Calculate differences
  const tradeEfficiencyDiff = userFlow.metrics.tradeEfficiency > 0 && avgProTradeEff > 0
    ? userFlow.metrics.tradeEfficiency - avgProTradeEff
    : 0;
  const armySpendingDiff = userFlow.metrics.resourcesIntoArmy - avgProArmySpend;
  const survivalRateDiff = userFlow.metrics.armySurvivalRate - avgProSurvivalRate;
  const armyLossRateDiff = userFlow.metrics.armyLossRate - avgProLossRate;

  // Determine overall status (use loss rate instead of trade efficiency if no kill data)
  const hasTradeData = userFlow.metrics.tradeEfficiency > 0 && avgProTradeEff > 0;
  // Normalize all values to similar scales before combining.
  // tradeEfficiencyDiff is ratio-scale (~-1.5 to +1.5), while survivalRateDiff,
  // armyLossRateDiff, and armySpendingDiff are percentage-scale (-100 to +100).
  // Divide percentage-scale diffs by 100 so all terms are roughly -1 to +1.
  const score = hasTradeData
    ? (tradeEfficiencyDiff * 0.5) + (survivalRateDiff / 100 * 0.3) + (armySpendingDiff / 100 * 0.2)
    : (survivalRateDiff / 100 * 0.4) + (-armyLossRateDiff / 100 * 0.4) + (armySpendingDiff / 100 * 0.2);

  let status: 'excellent' | 'good' | 'average' | 'poor';
  if (score > 0.3) status = 'excellent';
  else if (score > 0.1) status = 'good';
  else if (score > -0.1) status = 'average';
  else status = 'poor';

  return {
    tradeEfficiencyDiff,
    armySpendingDiff,
    survivalRateDiff,
    armyLossRateDiff,
    avgProLossRate,
    status,
    hasTradeData,
  };
}

/**
 * Format resource value for display (K for thousands)
 */
export function formatResourceValue(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return Math.round(value).toString();
}

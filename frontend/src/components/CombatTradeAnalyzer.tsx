import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import SankeyFlowDiagram from './SankeyFlowDiagram';
import {
  analyzeResourceFlow,
  compareResourceEfficiency,
  type ResourceFlowData,
} from '../utils/combatAnalysis';
import type { Snapshot } from '../types';

interface CombatTradeAnalyzerProps {
  userSnapshots: Snapshot[];
  proSnapshotSets: Snapshot[][];
  title?: string;
}

export default function CombatTradeAnalyzer({
  userSnapshots,
  proSnapshotSets,
  title = '⚔️ Combat Trade Analysis',
}: CombatTradeAnalyzerProps) {
  // Analyze user resource flow
  const userFlow = useMemo(() => {
    return analyzeResourceFlow(userSnapshots);
  }, [userSnapshots]);

  // Analyze pro resource flows
  const proFlows = useMemo(() => {
    return proSnapshotSets.map(snapshots => analyzeResourceFlow(snapshots));
  }, [proSnapshotSets]);

  // Calculate pro average flow for comparison
  const proAverageFlow = useMemo((): ResourceFlowData => {
    if (proFlows.length === 0) {
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

    // Average all metrics
    const avgMetrics = {
      tradeEfficiency: proFlows.reduce((sum, f) => sum + f.metrics.tradeEfficiency, 0) / proFlows.length,
      resourcesIntoArmy: proFlows.reduce((sum, f) => sum + f.metrics.resourcesIntoArmy, 0) / proFlows.length,
      resourcesIntoEconomy: proFlows.reduce((sum, f) => sum + f.metrics.resourcesIntoEconomy, 0) / proFlows.length,
      resourcesIntoTech: proFlows.reduce((sum, f) => sum + f.metrics.resourcesIntoTech, 0) / proFlows.length,
      armySurvivalRate: proFlows.reduce((sum, f) => sum + f.metrics.armySurvivalRate, 0) / proFlows.length,
      armyLossRate: proFlows.reduce((sum, f) => sum + f.metrics.armyLossRate, 0) / proFlows.length,
    };

    // Collect all unique nodes from all pro flows
    const allNodeMap = new Map<string, { id: string; label: string; color?: string; values: number[] }>();
    proFlows.forEach(flow => {
      flow.nodes.forEach(node => {
        if (!allNodeMap.has(node.id)) {
          allNodeMap.set(node.id, { id: node.id, label: node.label, color: node.color, values: [] });
        }
        allNodeMap.get(node.id)!.values.push(node.value || 0);
      });
    });

    const avgNodes = Array.from(allNodeMap.values()).map(({ id, label, color, values }) => ({
      id,
      label,
      color,
      value: values.reduce((sum, v) => sum + v, 0) / values.length,
    }));

    // Collect all unique links from all pro flows, averaging values
    const allLinkMap = new Map<string, { source: string; target: string; values: number[] }>();
    proFlows.forEach(flow => {
      flow.links.forEach(link => {
        const key = `${link.source}->${link.target}`;
        if (!allLinkMap.has(key)) {
          allLinkMap.set(key, { source: link.source, target: link.target, values: [] });
        }
        allLinkMap.get(key)!.values.push(link.value || 0);
      });
    });

    const avgLinks = Array.from(allLinkMap.values()).map(({ source, target, values }) => ({
      source,
      target,
      value: values.reduce((sum, v) => sum + v, 0) / values.length,
    }));

    return {
      nodes: avgNodes,
      links: avgLinks,
      metrics: avgMetrics,
    };
  }, [proFlows]);

  // Compare efficiency
  const comparison = useMemo(() => {
    return compareResourceEfficiency(userFlow, proFlows);
  }, [userFlow, proFlows]);

  if (!userSnapshots || userSnapshots.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold bg-gradient-to-r from-sc2-purple to-sc2-blue bg-clip-text text-transparent">
          {title}
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Visualizing resource flow from collection through spending to combat outcomes
        </p>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SankeyFlowDiagram
          data={userFlow}
          title="Your Resource Flow"
          subtitle="How you collected, spent, and traded resources"
          height={500}
        />

        <SankeyFlowDiagram
          data={proAverageFlow}
          title="Pro Average Resource Flow"
          subtitle={`Average of ${proFlows.length} similar pro ${proFlows.length === 1 ? 'game' : 'games'}`}
          height={500}
        />
      </div>

      {/* Comparison insights */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">📊 Efficiency Comparison</h3>

        {/* Overall status */}
        <div className={`p-4 rounded-lg mb-4 ${getStatusBgColor(comparison.status)}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-400">Overall Combat Efficiency</div>
              <div className={`text-2xl font-bold ${getStatusTextColor(comparison.status)}`}>
                {comparison.status.toUpperCase()}
              </div>
            </div>
            <div className="text-4xl">{getStatusEmoji(comparison.status)}</div>
          </div>
        </div>

        {/* Detailed comparisons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Show Trade Efficiency if we have kill data, otherwise show Army Loss Rate */}
          {comparison.hasTradeData ? (
            <ComparisonCard
              label="Trade Efficiency"
              userValue={
                userFlow.metrics.tradeEfficiency > 100
                  ? '∞'
                  : userFlow.metrics.tradeEfficiency.toFixed(2)
              }
              proValue={
                proAverageFlow.metrics.tradeEfficiency > 100
                  ? '∞'
                  : proAverageFlow.metrics.tradeEfficiency.toFixed(2)
              }
              difference={comparison.tradeEfficiencyDiff}
              description="Killed / Lost ratio"
              higherIsBetter={true}
            />
          ) : (
            <ComparisonCard
              label="Army Loss Rate"
              userValue={`${userFlow.metrics.armyLossRate.toFixed(1)}%`}
              proValue={`${comparison.avgProLossRate.toFixed(1)}%`}
              difference={comparison.armyLossRateDiff}
              description="% of army lost in combat"
              higherIsBetter={false}
            />
          )}

          <ComparisonCard
            label="Army Survival Rate"
            userValue={`${userFlow.metrics.armySurvivalRate.toFixed(1)}%`}
            proValue={`${proAverageFlow.metrics.armySurvivalRate.toFixed(1)}%`}
            difference={comparison.survivalRateDiff}
            description="Army still alive at end"
            higherIsBetter={true}
          />

          <ComparisonCard
            label="Army Investment"
            userValue={`${userFlow.metrics.resourcesIntoArmy.toFixed(1)}%`}
            proValue={`${proAverageFlow.metrics.resourcesIntoArmy.toFixed(1)}%`}
            difference={comparison.armySpendingDiff}
            description="Resources into army"
            higherIsBetter={null} // Context-dependent
          />
        </div>

        {/* Insights */}
        <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <h4 className="text-sm font-semibold text-slate-300 mb-2">💡 Key Insights</h4>
          <ul className="space-y-2 text-sm text-slate-400">
            {generateInsights(userFlow, proAverageFlow, comparison).map((insight, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-sc2-blue mt-0.5">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// Helper components

interface ComparisonCardProps {
  label: string;
  userValue: string;
  proValue: string;
  difference: number;
  description: string;
  higherIsBetter: boolean | null;
}

function ComparisonCard({
  label,
  userValue,
  proValue,
  difference,
  description,
  higherIsBetter,
}: ComparisonCardProps) {
  const isPositive = difference > 0;
  const isBetter = higherIsBetter === null ? null : (higherIsBetter ? isPositive : !isPositive);

  return (
    <div className="stat-card">
      <div className="text-xs text-slate-400 mb-2">{label}</div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <div className="text-xs text-slate-500">You</div>
          <div className="text-lg font-bold text-sc2-blue">{userValue}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">Pro Avg</div>
          <div className="text-lg font-bold text-sc2-gold">{proValue}</div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700">
        <div className="text-xs text-slate-500">{description}</div>
        {isBetter !== null && (
          <div className={`flex items-center gap-1 ${isBetter ? 'text-green-400' : 'text-red-400'}`}>
            {isBetter ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span className="text-xs font-semibold">
              {isPositive ? '+' : ''}{Math.abs(difference).toFixed(1)}
            </span>
          </div>
        )}
        {isBetter === null && Math.abs(difference) > 0.1 && (
          <div className="flex items-center gap-1 text-slate-400">
            <Minus className="w-3 h-3" />
            <span className="text-xs">
              {isPositive ? '+' : ''}{difference.toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper functions

function getStatusBgColor(status: string): string {
  const colors = {
    excellent: 'bg-green-500/10 border border-green-500/30',
    good: 'bg-emerald-500/10 border border-emerald-500/30',
    average: 'bg-yellow-500/10 border border-yellow-500/30',
    poor: 'bg-red-500/10 border border-red-500/30',
  };
  return colors[status as keyof typeof colors] || colors.average;
}

function getStatusTextColor(status: string): string {
  const colors = {
    excellent: 'text-green-400',
    good: 'text-emerald-400',
    average: 'text-yellow-400',
    poor: 'text-red-400',
  };
  return colors[status as keyof typeof colors] || colors.average;
}

function getStatusEmoji(status: string): string {
  const emojis = {
    excellent: '🏆',
    good: '✅',
    average: '⚖️',
    poor: '⚠️',
  };
  return emojis[status as keyof typeof emojis] || '⚖️';
}

function generateInsights(
  userFlow: ResourceFlowData,
  proFlow: ResourceFlowData,
  comparison: any
): string[] {
  const insights: string[] = [];

  // Trade efficiency insight (only if we have trade data)
  if (comparison.hasTradeData) {
    if (comparison.tradeEfficiencyDiff > 0.3) {
      insights.push(
        `Excellent combat trades! You're trading ${((userFlow.metrics.tradeEfficiency - 1) * 100).toFixed(0)}% more efficiently than the pros analyzed.`
      );
    } else if (comparison.tradeEfficiencyDiff < -0.3) {
      insights.push(
        `Combat trades need improvement. You're losing more units than you're killing compared to pro benchmarks.`
      );
    }
  } else if (userFlow.metrics.tradeEfficiency === 0 && proFlow.metrics.tradeEfficiency === 0) {
    insights.push(
      `Combat trade data not available for comparison. This replay may be missing kill/loss tracking data.`
    );
  }

  // Army survival insight
  if (userFlow.metrics.armySurvivalRate < 30 && proFlow.metrics.armySurvivalRate > 50) {
    insights.push(
      `Low army survival rate (${userFlow.metrics.armySurvivalRate.toFixed(0)}%). Pros kept ${proFlow.metrics.armySurvivalRate.toFixed(0)}% of their army alive.`
    );
  } else if (userFlow.metrics.armySurvivalRate > 70) {
    insights.push(
      `High army survival rate suggests either good engagements or not enough aggression.`
    );
  }

  // Army investment insight
  if (Math.abs(comparison.armySpendingDiff) > 10) {
    if (comparison.armySpendingDiff > 0) {
      insights.push(
        `You invested ${comparison.armySpendingDiff.toFixed(0)}% more into army production. This could be aggressive or defensive depending on strategy.`
      );
    } else {
      insights.push(
        `You invested ${Math.abs(comparison.armySpendingDiff).toFixed(0)}% less into army. Make sure you're not being too greedy with economy.`
      );
    }
  }

  // Default insight if nothing specific
  if (insights.length === 0) {
    insights.push(
      'Your resource allocation is similar to pro patterns. Focus on execution and timing to improve further.'
    );
  }

  return insights;
}

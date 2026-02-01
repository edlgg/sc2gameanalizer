import { useMemo } from 'react';
import { AlertTriangle, Clock, Package } from 'lucide-react';
import {
  analyzeSupplyBlocks,
  compareSupplyBlocks,
  formatTime,
  type SupplyBlockImpact,
} from '../utils/supplyBlockAnalysis';
import type { Snapshot } from '../types';

interface SupplyBlockAnalyzerProps {
  userSnapshots: Snapshot[];
  proSnapshotSets: Snapshot[][];
  userRace: string;
  title?: string;
}

export default function SupplyBlockAnalyzer({
  userSnapshots,
  proSnapshotSets,
  userRace,
  title = '⚠️ Supply Block Analysis',
}: SupplyBlockAnalyzerProps) {
  // Analyze user supply blocks
  const userBlocks = useMemo(() => {
    return analyzeSupplyBlocks(userSnapshots, userRace);
  }, [userSnapshots, userRace]);

  // Analyze pro supply blocks
  const proBlocksList = useMemo(() => {
    return proSnapshotSets.map(snapshots => {
      // Get race from first snapshot
      const race = snapshots[0]?.race || userRace;
      return analyzeSupplyBlocks(snapshots, race);
    });
  }, [proSnapshotSets, userRace]);

  // Compare with pros
  const comparison = useMemo(() => {
    return compareSupplyBlocks(userBlocks, proBlocksList);
  }, [userBlocks, proBlocksList]);

  if (!userSnapshots || userSnapshots.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            {title}
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Quantifying the economic cost of being supply blocked
          </p>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          label="Total Blocked Time"
          value={`${Math.round(userBlocks.totalBlockedTime)}s`}
          comparison={`Pro avg: ${Math.round(comparison.avgProBlockedTime)}s`}
          status={
            comparison.userTimeDiff < 10
              ? 'good'
              : comparison.userTimeDiff < 30
              ? 'average'
              : 'poor'
          }
        />

        <StatCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Block Count"
          value={userBlocks.totalBlocks.toString()}
          comparison={`Pro avg: ${Math.round(comparison.avgProBlocks)}`}
          status={
            userBlocks.totalBlocks <= comparison.avgProBlocks + 1
              ? 'good'
              : userBlocks.totalBlocks <= comparison.avgProBlocks + 3
              ? 'average'
              : 'poor'
          }
        />

        <StatCard
          icon={<Package className="w-4 h-4" />}
          label="Wasted Minerals"
          value={Math.round(userBlocks.wastedMinerals).toLocaleString()}
          comparison={`~${Math.round(userBlocks.wastedMinerals / 50)} workers not made`}
          status={userBlocks.wastedMinerals < 1000 ? 'good' : userBlocks.wastedMinerals < 2000 ? 'average' : 'poor'}
        />

        <StatCard
          icon={<Package className="w-4 h-4" />}
          label="Wasted Gas"
          value={Math.round(userBlocks.wastedGas).toLocaleString()}
          comparison="Opportunity cost"
          status={userBlocks.wastedGas < 500 ? 'good' : userBlocks.wastedGas < 1000 ? 'average' : 'poor'}
        />
      </div>

      {/* Overall Status */}
      <div className={`p-4 rounded-lg mb-6 ${getStatusBgColor(comparison.status)}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-400">Supply Block Management</div>
            <div className={`text-2xl font-bold ${getStatusTextColor(comparison.status)}`}>
              {comparison.status.toUpperCase()}
            </div>
            {comparison.userTimeDiff > 0 ? (
              <div className="text-sm text-slate-400 mt-1">
                {Math.round(comparison.userTimeDiff)}s more blocked than pro average
              </div>
            ) : (
              <div className="text-sm text-green-400 mt-1">
                {Math.abs(Math.round(comparison.userTimeDiff))}s less blocked than pro average
              </div>
            )}
          </div>
          <div className="text-4xl">{getStatusEmoji(comparison.status)}</div>
        </div>
      </div>

      {/* Ghost Units - What you could have built */}
      {userBlocks.ghostUnits.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">
            👻 Units You Could Have Built
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {userBlocks.ghostUnits.map((unit, i) => (
              <div
                key={i}
                className="p-3 bg-slate-800/50 rounded-lg border border-slate-700"
              >
                <div className="text-2xl font-bold text-sc2-blue">{unit.count}</div>
                <div className="text-sm text-slate-300">{unit.name}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {unit.cost.minerals}m
                  {unit.cost.gas > 0 && ` / ${unit.cost.gas}g`}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            These are the units you could have produced with the resources wasted during supply blocks.
            This calculation assumes 50% production efficiency loss while supply blocked.
          </p>
        </div>
      )}

      {/* Critical Blocks */}
      {userBlocks.criticalBlocks.length > 0 && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <h4 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Critical Supply Blocks ({userBlocks.criticalBlocks.length})
          </h4>
          <div className="space-y-2">
            {userBlocks.criticalBlocks.map((block, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm p-2 bg-slate-800/50 rounded"
              >
                <div>
                  <span className="text-slate-300 font-mono">{formatTime(block.time)}</span>
                  <span className="text-slate-400 ml-2">-</span>
                  <span className="text-slate-400 ml-2">{block.reason}</span>
                </div>
                <div className="text-red-400 font-semibold">
                  {Math.round(block.duration)}s blocked
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Supply blocks during critical timing windows or extremely long blocks can lose games.
          </p>
        </div>
      )}

      {/* Insights */}
      <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">💡 Key Insights</h4>
        <ul className="space-y-2 text-sm text-slate-400">
          {generateInsights(userBlocks, comparison).map((insight, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-sc2-blue mt-0.5">•</span>
              <span>{insight}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Helper components

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  comparison: string;
  status: 'good' | 'average' | 'poor';
}

function StatCard({ icon, label, value, comparison, status }: StatCardProps) {
  const statusColor = {
    good: 'text-green-400',
    average: 'text-yellow-400',
    poor: 'text-red-400',
  }[status];

  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 text-slate-400 mb-2">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${statusColor}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{comparison}</div>
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
  userBlocks: SupplyBlockImpact,
  comparison: any
): string[] {
  const insights: string[] = [];

  if (comparison.status === 'excellent' || comparison.status === 'good') {
    insights.push(
      `Excellent supply management! You were only blocked for ${Math.round(userBlocks.totalBlockedTime)} seconds total.`
    );
  } else if (userBlocks.totalBlockedTime > 60) {
    insights.push(
      `You spent ${Math.round(userBlocks.totalBlockedTime)} seconds supply blocked, losing significant production time.`
    );
  }

  if (userBlocks.criticalBlocks.length > 0) {
    insights.push(
      `${userBlocks.criticalBlocks.length} supply ${userBlocks.criticalBlocks.length === 1 ? 'block' : 'blocks'} occurred during critical timing windows. These blocks can cost you the game.`
    );
  }

  if (userBlocks.wastedMinerals > 2000) {
    insights.push(
      `You wasted ${Math.round(userBlocks.wastedMinerals)} minerals to supply blocks - enough for ${Math.round(userBlocks.wastedMinerals / 400)} expansions or major tech investments.`
    );
  }

  if (userBlocks.ghostUnits.length > 0) {
    const firstUnit = userBlocks.ghostUnits[0];
    insights.push(
      `With better supply management, you could have produced ${firstUnit.count} additional ${firstUnit.name}${firstUnit.count > 1 ? 's' : ''}.`
    );
  }

  if (comparison.userTimeDiff < 0) {
    insights.push(
      `You actually blocked less than the pro average! Your supply management is strong.`
    );
  }

  if (insights.length === 0) {
    insights.push(
      'Monitor your supply more closely. Set up hotkeys to quickly build supply when needed.'
    );
  }

  return insights;
}

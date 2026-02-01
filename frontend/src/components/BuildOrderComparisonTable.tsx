import { useMemo } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import type { BuildOrderAnalysis, BuildOrderEvent } from '../types';

interface BuildOrderComparisonTableProps {
  userEvents: BuildOrderEvent[];
  analysis: BuildOrderAnalysis;
  proEventsCount: number;
}

// Format seconds as MM:SS
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds) % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Get icon color based on timing status
const getStatusColor = (status: string) => {
  switch (status) {
    case 'early':
      return 'text-green-400';
    case 'late':
      return 'text-red-400';
    case 'on-time':
      return 'text-slate-300';
    default:
      return 'text-slate-400';
  }
};

// Get icon for timing status
const getStatusIcon = (status: string) => {
  if (status === 'early') {
    return <TrendingUp className="w-4 h-4" />;
  } else if (status === 'late') {
    return <TrendingDown className="w-4 h-4" />;
  } else {
    return <Minus className="w-4 h-4" />;
  }
};

// Emoji for event type
const getEventEmoji = (eventType: string) => {
  switch (eventType) {
    case 'building':
      return '🏗️';
    case 'unit':
      return '⚔️';
    case 'upgrade':
      return '⬆️';
    default:
      return '📦';
  }
};

export default function BuildOrderComparisonTable({
  userEvents,
  analysis,
  proEventsCount,
}: BuildOrderComparisonTableProps) {
  // Filter to only milestone events for main table
  const milestoneComparisons = useMemo(() => {
    return analysis.comparisons.filter(comp => {
      // Check if this event is marked as milestone in user events
      return userEvents.some(
        e => e.item_name === comp.item_name &&
             e.event_type === comp.event_type &&
             e.is_milestone
      );
    });
  }, [analysis.comparisons, userEvents]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5 text-sc2-blue" />
            Build Order Timeline Comparison
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Comparing against {proEventsCount} pro {proEventsCount === 1 ? 'game' : 'games'}
          </p>
        </div>
      </div>

      {/* Main comparison table */}
      {milestoneComparisons.length > 0 ? (
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left p-2 text-slate-400">Type</th>
                <th className="text-left p-2 text-slate-400">Item</th>
                <th className="text-right p-2 text-slate-400">Your Timing</th>
                <th className="text-right p-2 text-slate-400">Pro Avg</th>
                <th className="text-right p-2 text-slate-400">Difference</th>
                <th className="text-center p-2 text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {milestoneComparisons.map((comp, index) => {
                const statusColor = getStatusColor(comp.status);
                const diffAbs = Math.round(Math.abs(comp.difference));
                const diffSign = comp.difference > 0 ? '+' : '';

                return (
                  <tr
                    key={`${comp.event_type}-${comp.item_name}-${index}`}
                    className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="p-2">
                      <span className="flex items-center gap-1">
                        <span>{getEventEmoji(comp.event_type)}</span>
                        <span className="text-xs text-slate-500 capitalize">{comp.event_type}</span>
                      </span>
                    </td>
                    <td className="p-2 text-slate-300 font-medium">{comp.item_name}</td>
                    <td className="p-2 text-right text-sc2-blue font-mono">
                      {formatTime(comp.user_time)}
                    </td>
                    <td className="p-2 text-right text-sc2-gold font-mono">
                      {formatTime(comp.pro_avg_time)}
                    </td>
                    <td className={`p-2 text-right font-mono font-bold ${statusColor}`}>
                      {diffSign}{diffAbs}s
                    </td>
                    <td className="p-2 text-center">
                      <div className={`flex items-center justify-center gap-1 ${statusColor}`}>
                        {getStatusIcon(comp.status)}
                        <span className="text-xs capitalize">{comp.status}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No build order milestones detected</p>
        </div>
      )}

      {/* Missing items (things pros did that user didn't) */}
      {analysis.user_missing.length > 0 && (
        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Missing Milestones ({analysis.user_missing.length})
          </h4>
          <p className="text-xs text-slate-400 mb-3">
            Key buildings/units/upgrades that pros built but you didn't
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {analysis.user_missing.map((item, index) => (
              <div
                key={`missing-${item.event_type}-${item.item_name}-${index}`}
                className="text-xs bg-slate-800/50 p-2 rounded flex items-center justify-between"
              >
                <span className="flex items-center gap-1">
                  <span>{getEventEmoji(item.event_type)}</span>
                  <span className="text-slate-300">{item.item_name}</span>
                </span>
                <span className="text-slate-500 font-mono">
                  @{formatTime(item.pro_avg_time)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extra items (things user did that pros didn't - rare but possible) */}
      {analysis.user_extra.length > 0 && (
        <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Unique Choices ({analysis.user_extra.length})
          </h4>
          <p className="text-xs text-slate-400 mb-3">
            Things you built that pros didn't (could be creative or off-meta)
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {analysis.user_extra.map((item, index) => (
              <div
                key={`extra-${item.event_type}-${item.item_name}-${index}`}
                className="text-xs bg-slate-800/50 p-2 rounded flex items-center justify-between"
              >
                <span className="flex items-center gap-1">
                  <span>{getEventEmoji(item.event_type)}</span>
                  <span className="text-slate-300">{item.item_name}</span>
                </span>
                <span className="text-slate-500 font-mono">
                  @{formatTime(item.user_time)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-green-400" />
          <span>Early = Built before pros (5+ seconds)</span>
        </div>
        <div className="flex items-center gap-1">
          <Minus className="w-3 h-3 text-slate-300" />
          <span>On-time = Within 5 seconds of pros</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingDown className="w-3 h-3 text-red-400" />
          <span>Late = Built after pros (5+ seconds)</span>
        </div>
      </div>
    </div>
  );
}

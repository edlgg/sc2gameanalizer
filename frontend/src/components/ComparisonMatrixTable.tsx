import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import type { Snapshot, SimilarGame } from '../types';

interface ComparisonMatrixTableProps {
  userSnapshots: Snapshot[];
  proSnapshotSets: Snapshot[][];
  selectedProGameIds: number[];
  similarGames: SimilarGame[];
}

interface MatrixRow {
  timestamp: number;
  timeFormatted: string;
  metric: string;
  metricLabel: string;
  userValue: number;
  proValues: { [gameId: string]: number };
  proAvg: number;
}

// Dynamic timestamps generated from game length (every 3 min up to game end)
function generateTimestamps(maxSeconds: number): number[] {
  const stamps: number[] = [];
  for (let t = 180; t <= maxSeconds; t += 180) {
    stamps.push(t);
  }
  return stamps;
}

const METRICS = [
  { key: 'worker_count', label: 'Workers', format: (v: number) => Math.round(v).toString() },
  { key: 'army_value', label: 'Army Value', format: (v: number) => Math.round(v).toLocaleString() },
  { key: 'base_count', label: 'Bases', format: (v: number) => Math.round(v).toString() },
  { key: 'unspent', label: 'Unspent Resources', format: (v: number) => Math.round(v).toLocaleString() },
];

export default function ComparisonMatrixTable({
  userSnapshots,
  proSnapshotSets,
  selectedProGameIds,
  similarGames,
}: ComparisonMatrixTableProps) {
  const [sortBy, setSortBy] = useState<'time' | 'metric'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Helper to find closest snapshot
  const findClosestSnapshot = (snapshots: Snapshot[], targetTime: number): Snapshot | null => {
    if (!snapshots || snapshots.length === 0) return null;

    const closest = snapshots.reduce((prev, curr) => {
      return Math.abs(curr.game_time_seconds - targetTime) < Math.abs(prev.game_time_seconds - targetTime)
        ? curr
        : prev;
    });

    return Math.abs(closest.game_time_seconds - targetTime) <= 30 ? closest : null;
  };

  // Helper to extract metric value
  const getMetricValue = (snapshot: Snapshot | null, metricKey: string): number => {
    if (!snapshot) return 0;

    if (metricKey === 'army_value') {
      return snapshot.army_value_minerals + snapshot.army_value_gas;
    } else if (metricKey === 'unspent') {
      return snapshot.unspent_minerals + snapshot.unspent_gas;
    }
    return snapshot[metricKey as keyof Snapshot] as number;
  };

  // Build matrix data
  const matrixData = useMemo(() => {
    const rows: MatrixRow[] = [];

    // Find the actual game length for the user (last snapshot with meaningful data)
    const userGameLength = userSnapshots.length > 0
      ? userSnapshots[userSnapshots.length - 1].game_time_seconds
      : 0;

    // Helper to check if a game is still active at a timestamp
    const isGameActive = (snapshots: Snapshot[], timestamp: number): boolean => {
      const snap = findClosestSnapshot(snapshots, timestamp);
      if (!snap) return false;

      // A game is considered ended if worker count is 0 (game over)
      // We use worker count as the indicator because even if you lose all bases,
      // you still have workers until the game truly ends
      return snap.worker_count > 0;
    };

    // Only use timestamps up to when the user's game ended
    const validTimestamps = generateTimestamps(userGameLength);

    validTimestamps.forEach((timestamp) => {
      // Skip if user's game has ended at this timestamp
      if (!isGameActive(userSnapshots, timestamp)) {
        return;
      }

      const timeFormatted = `${Math.floor(timestamp / 60)}:${(timestamp % 60).toString().padStart(2, '0')}`;

      METRICS.forEach((metric) => {
        // Get user value
        const userSnap = findClosestSnapshot(userSnapshots, timestamp);
        const userValue = getMetricValue(userSnap, metric.key);

        // Get pro values, but only from games that are still active at this timestamp
        const proValues: { [gameId: string]: number } = {};
        const activeProValues: number[] = [];

        selectedProGameIds.forEach((gameId, index) => {
          const proSnapshots = proSnapshotSets[index];
          const isActive = isGameActive(proSnapshots, timestamp);

          if (isActive) {
            const proSnap = findClosestSnapshot(proSnapshots, timestamp);
            const value = getMetricValue(proSnap, metric.key);
            proValues[gameId] = value;
            activeProValues.push(value);
          } else {
            // Mark as null to indicate game ended
            proValues[gameId] = -1; // -1 means game ended, will show as "—"
          }
        });

        // Calculate pro average ONLY from active games
        const proAvg = activeProValues.length > 0
          ? activeProValues.reduce((sum, v) => sum + v, 0) / activeProValues.length
          : 0;

        rows.push({
          timestamp,
          timeFormatted,
          metric: metric.key,
          metricLabel: metric.label,
          userValue,
          proValues,
          proAvg,
        });
      });
    });

    return rows;
  }, [userSnapshots, proSnapshotSets, selectedProGameIds]);

  // Sort data
  const sortedData = useMemo(() => {
    const sorted = [...matrixData];

    sorted.sort((a, b) => {
      let comparison = 0;

      if (sortBy === 'time') {
        comparison = a.timestamp - b.timestamp;
      } else {
        comparison = a.metric.localeCompare(b.metric);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [matrixData, sortBy, sortOrder]);

  // Toggle sort
  const handleSort = (newSortBy: 'time' | 'metric') => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  // Get game name
  const getGameName = (gameId: number): string => {
    const game = similarGames.find(g => g.game_id === gameId);
    return game ? (game.matched_player_name || game.player1_name) : `Game ${gameId}`;
  };

  // Color code cell based on comparison to average
  const getCellColor = (userValue: number, proAvg: number, metric: string): string => {
    const diff = userValue - proAvg;
    const threshold = metric === 'unspent' ? -100 : 0.1 * proAvg; // Unspent: lower is better

    if (metric === 'unspent') {
      // For unspent, lower is better
      if (userValue < proAvg * 0.9) return 'text-green-400'; // Significantly better
      if (userValue > proAvg * 1.2) return 'text-red-400'; // Significantly worse
    } else {
      // For other metrics, higher is better
      if (diff > threshold) return 'text-green-400';
      if (diff < -threshold) return 'text-red-400';
    }

    return 'text-slate-300';
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">📊 Comparison Matrix</h3>
        <div className="flex gap-2">
          <button
            onClick={() => handleSort('time')}
            className={`px-3 py-1 rounded text-sm flex items-center gap-1 transition-colors ${
              sortBy === 'time'
                ? 'bg-sc2-blue text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Time
            {sortBy === 'time' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
          </button>
          <button
            onClick={() => handleSort('metric')}
            className={`px-3 py-1 rounded text-sm flex items-center gap-1 transition-colors ${
              sortBy === 'metric'
                ? 'bg-sc2-blue text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Metric
            {sortBy === 'metric' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left p-2 text-slate-400">Time</th>
              <th className="text-left p-2 text-slate-400">Metric</th>
              <th className="text-right p-2 text-sc2-blue font-bold">You</th>
              {selectedProGameIds.map((gameId) => (
                <th key={gameId} className="text-right p-2 text-slate-400 text-xs">
                  {getGameName(gameId)}
                </th>
              ))}
              <th className="text-right p-2 text-sc2-gold font-bold">Pro Avg</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, index) => {
              const metricFormatter = METRICS.find(m => m.key === row.metric)?.format || ((v: number) => v.toString());
              const cellColor = getCellColor(row.userValue, row.proAvg, row.metric);

              return (
                <tr
                  key={`${row.timestamp}-${row.metric}`}
                  className={`border-b border-slate-800 hover:bg-slate-800/50 transition-colors ${
                    index % 4 === 0 ? 'border-t-2 border-slate-700' : ''
                  }`}
                >
                  <td className="p-2 text-slate-300 font-mono">{row.timeFormatted}</td>
                  <td className="p-2 text-slate-300">{row.metricLabel}</td>
                  <td className={`p-2 text-right font-bold ${cellColor}`}>
                    {metricFormatter(row.userValue)}
                  </td>
                  {selectedProGameIds.map((gameId) => {
                    const value = row.proValues[gameId];
                    return (
                      <td key={gameId} className="p-2 text-right text-slate-400 text-xs">
                        {value === -1 ? '—' : metricFormatter(value || 0)}
                      </td>
                    );
                  })}
                  <td className="p-2 text-right text-sc2-gold font-semibold">
                    {metricFormatter(row.proAvg)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-slate-500">
        <p><span className="text-green-400">●</span> Green = At or above pro average (better)</p>
        <p><span className="text-red-400">●</span> Red = Significantly below pro average (needs improvement)</p>
        <p><span className="text-slate-300">●</span> White = Close to pro average</p>
        <p className="mt-2"><span className="text-slate-400">—</span> = Game ended (not included in average)</p>
      </div>
    </div>
  );
}

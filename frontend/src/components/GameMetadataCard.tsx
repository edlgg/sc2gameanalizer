import { Trophy, Clock, Pickaxe, Swords, TrendingUp, Home } from 'lucide-react';
import { formatTime } from '../utils/formatters';
import type { Game, Snapshot } from '../types';

interface GameMetadataCardProps {
  game: Game;
  snapshots: Snapshot[];
  playerNumber: 1 | 2;
}

export default function GameMetadataCard({ game, snapshots, playerNumber }: GameMetadataCardProps) {
  if (snapshots.length === 0) return null;

  // Calculate stats from snapshots
  const lastSnapshot = snapshots[snapshots.length - 1];
  const peakArmyValue = snapshots.length > 0
    ? Math.max(...snapshots.map(s => s.army_value_minerals + s.army_value_gas))
    : 0;
  const avgUnspentMinerals = snapshots.length > 0
    ? Math.round(snapshots.reduce((sum, s) => sum + s.unspent_minerals, 0) / snapshots.length)
    : 0;
  const avgUnspentGas = snapshots.length > 0
    ? Math.round(snapshots.reduce((sum, s) => sum + s.unspent_gas, 0) / snapshots.length)
    : 0;
  const maxBases = snapshots.length > 0
    ? Math.max(...snapshots.map(s => s.base_count))
    : 0;

  // Determine winner info
  const isWinner = game.result === playerNumber;
  const winnerName = game.result === 1 ? game.player1_name : game.player2_name;

  // Calculate resource collection rate (per minute)
  const gameLengthMinutes = Math.max(game.game_length_seconds / 60, 0.01);
  const mineralRate = Math.round(lastSnapshot.total_minerals_collected / gameLengthMinutes);
  const gasRate = Math.round(lastSnapshot.total_gas_collected / gameLengthMinutes);

  // Calculate kill/death ratio
  const kdRatio = lastSnapshot.units_lost_value > 0
    ? (lastSnapshot.units_killed_value / lastSnapshot.units_lost_value).toFixed(2)
    : lastSnapshot.units_killed_value > 0 ? '∞' : '0.00';

  const stats = [
    {
      icon: Clock,
      label: 'Game Duration',
      value: formatTime(game.game_length_seconds),
      color: 'text-slate-400',
    },
    {
      icon: Trophy,
      label: 'Winner',
      value: winnerName,
      color: isWinner ? 'text-green-400' : 'text-red-400',
      highlight: true,
    },
    {
      icon: Pickaxe,
      label: 'Final Workers',
      value: lastSnapshot.worker_count.toString(),
      color: 'text-blue-400',
    },
    {
      icon: Swords,
      label: 'Peak Army Value',
      value: `${Math.round(peakArmyValue / 1000)}k`,
      color: 'text-red-400',
    },
    {
      icon: TrendingUp,
      label: 'Collection Rate/min',
      value: `${mineralRate}m / ${gasRate}g`,
      color: 'text-cyan-400',
    },
    {
      icon: Home,
      label: 'Max Bases',
      value: maxBases.toString(),
      color: 'text-purple-400',
    },
  ];

  const extraStats = [
    {
      label: 'Avg Unspent',
      value: `${avgUnspentMinerals}m / ${avgUnspentGas}g`,
      tooltip: 'Average unspent resources throughout the game',
    },
    {
      label: 'Total Collected',
      value: `${Math.round(lastSnapshot.total_minerals_collected / 1000)}k / ${Math.round(lastSnapshot.total_gas_collected / 1000)}k`,
      tooltip: 'Total resources collected',
    },
    {
      label: 'Kill/Death',
      value: kdRatio,
      tooltip: 'Army value killed vs lost',
    },
    {
      label: 'Spending Eff.',
      value: `${Math.round(lastSnapshot.spending_efficiency * 100)}%`,
      tooltip: 'How efficiently resources were spent',
    },
  ];

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4 text-slate-200">Game Overview</h3>

      {/* Main stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`flex flex-col items-center p-3 rounded-lg bg-slate-800/50 ${
                stat.highlight ? 'ring-1 ring-sc2-blue/30' : ''
              }`}
            >
              <Icon className={`w-5 h-5 ${stat.color} mb-2`} />
              <div className="text-xs text-slate-500 mb-1 text-center">{stat.label}</div>
              <div className={`text-sm font-bold ${stat.color}`}>{stat.value}</div>
            </div>
          );
        })}
      </div>

      {/* Extra stats - compact row */}
      <div className="flex flex-wrap gap-4 text-xs border-t border-slate-700 pt-3">
        {extraStats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-2" title={stat.tooltip}>
            <span className="text-slate-500">{stat.label}:</span>
            <span className="text-slate-300 font-semibold">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Map name */}
      <div className="mt-3 pt-3 border-t border-slate-700">
        <span className="text-xs text-slate-500">Map: </span>
        <span className="text-sm text-slate-300 font-medium">{game.map_name}</span>
      </div>
    </div>
  );
}

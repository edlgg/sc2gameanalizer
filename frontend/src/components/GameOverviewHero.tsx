import { formatTime } from '../utils/formatters';
import type { Game, Snapshot } from '../types';

interface GameOverviewHeroProps {
  game: Game;
  snapshots: Snapshot[];
  playerNumber: 1 | 2;
}

export default function GameOverviewHero({ game, snapshots, playerNumber }: GameOverviewHeroProps) {
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

  // Get player race and opponent race
  const playerRace = playerNumber === 1 ? game.player1_race : game.player2_race;
  const opponentRace = playerNumber === 1 ? game.player2_race : game.player1_race;

  const metadata = [
    {
      label: 'DURATION',
      value: formatTime(game.game_length_seconds),
    },
    {
      label: 'WINNER',
      value: winnerName,
    },
    {
      label: 'FINAL WORKERS',
      value: lastSnapshot.worker_count.toString(),
    },
    {
      label: 'PEAK ARMY',
      value: `${Math.round(peakArmyValue / 1000)}K`,
    },
    {
      label: 'COLLECTION/MIN',
      value: `${mineralRate}M / ${gasRate}G`,
    },
    {
      label: 'MAX BASES',
      value: maxBases.toString(),
    },
    {
      label: 'AVG UNSPENT',
      value: `${avgUnspentMinerals}M / ${avgUnspentGas}G`,
    },
    {
      label: 'KILL/DEATH',
      value: kdRatio,
    },
  ];

  return (
    <div className="ed-game-hero ed-animate-in">
      <div className="ed-game-hero-inner">
        {/* Left: Dramatic Stats */}
        <div className="ed-game-hero-stats">
          <div className="ed-game-hero-matchup">
            {playerRace} VS {opponentRace}
          </div>
          <div className="ed-game-hero-map">
            {game.map_name.toUpperCase()}
          </div>
          <div className="ed-game-hero-result">
            {isWinner ? '✓ VICTORY' : '✗ DEFEAT'} • {game.game_speed}
          </div>
        </div>

        {/* Right: Metadata Grid */}
        <div className="ed-game-hero-metadata">
          {metadata.map((item, index) => (
            <div key={index} className="ed-game-hero-meta-card">
              <div className="ed-game-hero-meta-label">{item.label}</div>
              <div className="ed-game-hero-meta-value">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

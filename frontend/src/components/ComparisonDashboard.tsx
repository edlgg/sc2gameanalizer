import { useState } from 'react';
import { ArrowLeft, Loader2, Info } from 'lucide-react';
import { useSimilarGames, useSnapshots } from '../hooks/useGames';
import { mergeSnapshotsForComparison, calculateDelta, extractKeyMoments } from '../utils/formatters';
import TimelineChart from './charts/TimelineChart';
import DeltaChart from './charts/DeltaChart';
import KeyMomentsPanel from './KeyMomentsPanel';
import PerformanceRadar from './charts/PerformanceRadar';

interface ComparisonDashboardProps {
  gameId: number;
  onBack: () => void;
}

export default function ComparisonDashboard({ gameId, onBack }: ComparisonDashboardProps) {
  const [selectedProGameId, setSelectedProGameId] = useState<number | null>(null);

  // Fetch similar pro games
  const { data: similarGames, isLoading: loadingSimilar } = useSimilarGames(gameId, 3);

  // Fetch user game snapshots
  const { data: userSnapshots, isLoading: loadingUser } = useSnapshots(gameId, 1);

  // Fetch pro game snapshots (when selected)
  const { data: proSnapshots, isLoading: loadingPro } = useSnapshots(selectedProGameId, 1);

  // Auto-select first similar game
  if (similarGames && similarGames.length > 0 && !selectedProGameId) {
    setSelectedProGameId(similarGames[0].game_id);
  }

  if (loadingSimilar || loadingUser) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-sc2-blue" />
        <p className="text-slate-400">Finding similar pro games...</p>
      </div>
    );
  }

  if (!similarGames || similarGames.length === 0) {
    return (
      <div className="card text-center py-12">
        <Info className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No Pro Games Available</h3>
        <p className="text-slate-400 mb-4">
          Please upload some pro replays first to enable comparison.
        </p>
        <button onClick={onBack} className="btn-secondary">
          <ArrowLeft className="w-4 h-4 inline mr-2" />
          Back to Library
        </button>
      </div>
    );
  }

  const selectedProGame = similarGames.find(g => g.game_id === selectedProGameId);
  const hasData = userSnapshots && proSnapshots && userSnapshots.length > 0 && proSnapshots.length > 0;

  // Prepare chart data
  const workerData = hasData ? mergeSnapshotsForComparison(userSnapshots, proSnapshots, 'worker_count') : [];
  const armyData = hasData ? mergeSnapshotsForComparison(
    userSnapshots.map(s => ({ ...s, army_value_total: s.army_value_minerals + s.army_value_gas })) as any,
    proSnapshots.map(s => ({ ...s, army_value_total: s.army_value_minerals + s.army_value_gas })) as any,
    'army_value_total' as any
  ) : [];
  const baseData = hasData ? mergeSnapshotsForComparison(userSnapshots, proSnapshots, 'base_count') : [];
  const unspentData = hasData ? mergeSnapshotsForComparison(
    userSnapshots.map(s => ({ ...s, unspent_total: s.unspent_minerals + s.unspent_gas })) as any,
    proSnapshots.map(s => ({ ...s, unspent_total: s.unspent_minerals + s.unspent_gas })) as any,
    'unspent_total' as any
  ) : [];

  // Calculate deltas
  const workerDelta = hasData ? calculateDelta(userSnapshots, proSnapshots, 'worker_count') : [];
  const armyDelta = hasData ? calculateDelta(
    userSnapshots.map(s => ({ ...s, army_total: s.army_value_minerals + s.army_value_gas })) as any,
    proSnapshots.map(s => ({ ...s, army_total: s.army_value_minerals + s.army_value_gas })) as any,
    'army_total' as any
  ) : [];

  // Extract key moments
  const keyMoments = hasData ? extractKeyMoments(userSnapshots, proSnapshots) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="btn-secondary">
          <ArrowLeft className="w-4 h-4 inline mr-2" />
          Back
        </button>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-sc2-blue to-sc2-purple bg-clip-text text-transparent">
          Performance Analysis
        </h2>
        <div className="w-24" />
      </div>

      {/* Similar Games Selector */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">
          📊 Similar Pro Games ({similarGames.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {similarGames.map((game) => (
            <button
              key={game.game_id}
              onClick={() => setSelectedProGameId(game.game_id)}
              className={`p-4 rounded-lg border-2 transition-all text-left hover:scale-105 ${
                selectedProGameId === game.game_id
                  ? 'border-sc2-blue bg-sc2-blue/10 shadow-lg shadow-sc2-blue/20'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold truncate">{game.player1_name}</span>
                <div className="px-2 py-1 bg-sc2-gold/20 text-sc2-gold rounded text-xs font-bold">
                  {Math.round(game.similarity_score * 100)}%
                </div>
              </div>
              <div className="text-sm text-slate-400">
                {game.player1_race} v {game.player2_race}
              </div>
              <div className="text-xs text-slate-500 truncate mt-1">{game.map_name}</div>
            </button>
          ))}
        </div>
        {selectedProGame && (
          <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="text-sm text-slate-400">Comparing against:</div>
            <div className="font-semibold text-white mt-1">
              {selectedProGame.player1_name} ({selectedProGame.matchup}) on {selectedProGame.map_name}
            </div>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loadingPro && (
        <div className="card text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-sc2-blue mx-auto mb-2" />
          <p className="text-slate-400">Loading pro game data...</p>
        </div>
      )}

      {/* Charts - only show when data is loaded */}
      {hasData && (
        <>
          {/* Performance Overview */}
          <PerformanceRadar userSnapshots={userSnapshots} proSnapshots={proSnapshots} />

          {/* Timeline Comparisons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TimelineChart
              data={workerData}
              title="👷 Worker Count Over Time"
              label1="You"
              label2="Pro"
              color1="#00a8ff"
              color2="#ffd700"
              type="line"
              showDifference
            />

            <TimelineChart
              data={armyData}
              title="⚔️ Army Value Over Time"
              label1="You"
              label2="Pro"
              color1="#00a8ff"
              color2="#ffd700"
              type="area"
              showDifference
            />

            <TimelineChart
              data={baseData}
              title="🏠 Base Count Over Time"
              label1="You"
              label2="Pro"
              color1="#00a8ff"
              color2="#ffd700"
              type="line"
              showDifference
            />

            <TimelineChart
              data={unspentData}
              title="💰 Unspent Resources Over Time"
              label1="You"
              label2="Pro"
              color1="#00a8ff"
              color2="#ffd700"
              type="area"
              showDifference
            />
          </div>

          {/* Delta Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DeltaChart
              data={workerDelta}
              title="📊 Worker Difference"
              description="Positive = ahead of pro, Negative = behind pro"
            />

            <DeltaChart
              data={armyDelta}
              title="📊 Army Value Difference"
              description="Shows your resource advantage/disadvantage over time"
            />
          </div>

          {/* Key Moments */}
          <KeyMomentsPanel moments={keyMoments} />

          {/* Summary Stats */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">📋 Summary Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: 'Avg Workers',
                  user: Math.round(userSnapshots.reduce((sum, s) => sum + s.worker_count, 0) / userSnapshots.length),
                  pro: Math.round(proSnapshots.reduce((sum, s) => sum + s.worker_count, 0) / proSnapshots.length),
                },
                {
                  label: 'Avg Army Value',
                  user: Math.round(userSnapshots.reduce((sum, s) => sum + s.army_value_minerals + s.army_value_gas, 0) / userSnapshots.length),
                  pro: Math.round(proSnapshots.reduce((sum, s) => sum + s.army_value_minerals + s.army_value_gas, 0) / proSnapshots.length),
                },
                {
                  label: 'Avg Bases',
                  user: (userSnapshots.reduce((sum, s) => sum + s.base_count, 0) / userSnapshots.length).toFixed(1),
                  pro: (proSnapshots.reduce((sum, s) => sum + s.base_count, 0) / proSnapshots.length).toFixed(1),
                },
                {
                  label: 'Spending Efficiency',
                  user: Math.round(userSnapshots.reduce((sum, s) => sum + s.spending_efficiency, 0) / userSnapshots.length * 100),
                  pro: Math.round(proSnapshots.reduce((sum, s) => sum + s.spending_efficiency, 0) / proSnapshots.length * 100),
                  suffix: '%',
                },
              ].map((stat, i) => (
                <div key={i} className="stat-card">
                  <div className="text-xs text-slate-400 mb-2">{stat.label}</div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-500">You</div>
                      <div className="text-lg font-bold text-sc2-blue">
                        {stat.user}{stat.suffix || ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Pro</div>
                      <div className="text-lg font-bold text-sc2-gold">
                        {stat.pro}{stat.suffix || ''}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

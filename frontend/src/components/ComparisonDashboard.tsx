import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Loader2, Info } from 'lucide-react';
import { useGame, useSimilarGames, useSnapshots, useMultipleProSnapshots, useBuildOrderComparison } from '../hooks/useGames';
import {
  mergeWithMultipleProGames,
  calculateDelta,
  extractKeyMoments,
  calculateAverageSnapshots
} from '../utils/formatters';
import TimelineChart from './charts/TimelineChart';
import DeltaChart from './charts/DeltaChart';
import KeyMomentsPanel from './KeyMomentsPanel';
import PerformanceRadar from './charts/PerformanceRadar';
import MultiProSelector from './MultiProSelector';
import ComparisonMatrixTable from './ComparisonMatrixTable';
import CumulativeSpendingCharts from './CumulativeSpendingCharts';
import BuildOrderComparisonTable from './BuildOrderComparisonTable';
import MilestoneTimeline from './MilestoneTimeline';
import UpgradeTimeline from './UpgradeTimeline';
import UnitTransitionAnalysis from './UnitTransitionAnalysis';
import TradeoffAnalysis from './TradeoffAnalysis';
import GameMetadataCard from './GameMetadataCard';
import CombatTradeAnalyzer from './CombatTradeAnalyzer';
import SupplyBlockAnalyzer from './SupplyBlockAnalyzer';
import WinProbabilityPredictor from './WinProbabilityPredictor';
import type { Snapshot } from '../types';

interface ComparisonDashboardProps {
  gameId: number;
  onBack: () => void;
}

export default function ComparisonDashboard({ gameId, onBack }: ComparisonDashboardProps) {
  const [selectedProGameIds, setSelectedProGameIds] = useState<Set<number>>(new Set());
  const [selectedPlayerNumber, setSelectedPlayerNumber] = useState<1 | 2>(1);

  // Fetch user game metadata
  const { data: userGame, isLoading: loadingGame } = useGame(gameId);

  // Auto-detect initial player (but allow manual override)
  useEffect(() => {
    if (!userGame) return;

    // Only auto-select if we haven't manually changed it
    const player2Name = userGame.player2_name.toLowerCase();
    const player1Name = userGame.player1_name.toLowerCase();

    if (player2Name.includes('a.i.') || player2Name.includes('ia') || player2Name.includes('computer')) {
      setSelectedPlayerNumber(1);
    } else if (player1Name.includes('a.i.') || player1Name.includes('ia') || player1Name.includes('computer')) {
      setSelectedPlayerNumber(2);
    }
    // Otherwise keep default (player 1)
  }, [userGame]);

  // Fetch similar pro games (fetch 5 to give more options)
  const { data: similarGames, isLoading: loadingSimilar } = useSimilarGames(gameId, 5);

  // Fetch user game snapshots (using selected player number)
  const { data: userSnapshots, isLoading: loadingUser } = useSnapshots(gameId, selectedPlayerNumber);

  // Fetch pro game snapshots for all selected games (with race matching)
  const proSnapshotQueries = useMultipleProSnapshots(Array.from(selectedProGameIds), gameId, selectedPlayerNumber);

  // Fetch build order comparison (using selected player number)
  const { data: buildOrderData, isLoading: loadingBuildOrder } = useBuildOrderComparison(
    gameId,
    Array.from(selectedProGameIds),
    selectedPlayerNumber
  );

  // Auto-select top 3 similar games
  useEffect(() => {
    if (similarGames && similarGames.length > 0 && selectedProGameIds.size === 0) {
      const topGames = similarGames.slice(0, Math.min(3, similarGames.length));
      setSelectedProGameIds(new Set(topGames.map(g => g.game_id)));
    }
  }, [similarGames, selectedProGameIds.size]);

  // Toggle pro game selection
  const handleToggleGame = (gameId: number) => {
    setSelectedProGameIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(gameId)) {
        // Don't allow deselecting if it's the last one
        if (newSet.size > 1) {
          newSet.delete(gameId);
        }
      } else {
        // Don't allow more than 5 games
        if (newSet.size < 5) {
          newSet.add(gameId);
        }
      }
      return newSet;
    });
  };

  // Check if all pro game data is loaded
  const allProSnapshotsLoaded = proSnapshotQueries.every(q => q.isSuccess);
  const anyProSnapshotLoading = proSnapshotQueries.some(q => q.isLoading);

  // Extract pro snapshots from queries
  const proSnapshotSets = useMemo(() => {
    return proSnapshotQueries
      .filter(q => q.isSuccess && q.data)
      .map(q => q.data as Snapshot[]);
  }, [proSnapshotQueries]);

  // Create game ID to name mapping (using matched player names)
  const proGameNames = useMemo(() => {
    const names: { [key: string]: string } = {};
    Array.from(selectedProGameIds).forEach((id) => {
      const game = similarGames?.find(g => g.game_id === id);
      if (game) {
        names[`pro${id}`] = game.matched_player_name;
      }
    });
    return names;
  }, [selectedProGameIds, similarGames]);

  // Get user game end time for trimming charts
  const userGameEndTime = useMemo(() => {
    if (!userSnapshots || userSnapshots.length === 0) return null;
    return Math.max(...userSnapshots.map(s => s.game_time_seconds));
  }, [userSnapshots]);

  // Calculate chart data with multi-game support
  const chartData = useMemo(() => {
    if (!userSnapshots || proSnapshotSets.length === 0) {
      return null;
    }

    const gameIds = Array.from(selectedProGameIds);

    // Helper to add computed fields to snapshots
    const addComputedFields = (snapshots: Snapshot[]) => {
      return snapshots.map(s => ({
        ...s,
        army_value_total: s.army_value_minerals + s.army_value_gas,
        unspent_total: s.unspent_minerals + s.unspent_gas,
      }));
    };

    const userWithComputed = addComputedFields(userSnapshots);
    const proSetsWithComputed = proSnapshotSets.map(addComputedFields);

    return {
      workerData: mergeWithMultipleProGames(
        userSnapshots,
        proSnapshotSets,
        gameIds,
        'worker_count',
        userGameEndTime ?? undefined
      ),
      armyData: mergeWithMultipleProGames(
        userWithComputed as any,
        proSetsWithComputed as any,
        gameIds,
        'army_value_total' as any,
        userGameEndTime ?? undefined
      ),
      baseData: mergeWithMultipleProGames(
        userSnapshots,
        proSnapshotSets,
        gameIds,
        'base_count',
        userGameEndTime ?? undefined
      ),
      unspentData: mergeWithMultipleProGames(
        userWithComputed as any,
        proSetsWithComputed as any,
        gameIds,
        'unspent_total' as any,
        userGameEndTime ?? undefined
      ),
    };
  }, [userSnapshots, proSnapshotSets, selectedProGameIds, userGameEndTime]);

  // Calculate deltas and key moments
  const deltaData = useMemo(() => {
    if (!userSnapshots || proSnapshotSets.length === 0) {
      return null;
    }

    const avgProSnapshots = calculateAverageSnapshots(proSnapshotSets);

    const userWithComputed = userSnapshots.map(s => ({
      ...s,
      army_total: s.army_value_minerals + s.army_value_gas,
    }));

    const proWithComputed = avgProSnapshots.map(s => ({
      ...s,
      army_total: s.army_value_minerals + s.army_value_gas,
    }));

    return {
      workerDelta: calculateDelta(userSnapshots, avgProSnapshots, 'worker_count', userGameEndTime ?? undefined),
      armyDelta: calculateDelta(userWithComputed as any, proWithComputed as any, 'army_total' as any, userGameEndTime ?? undefined),
      keyMoments: extractKeyMoments(userSnapshots, avgProSnapshots),
    };
  }, [userSnapshots, proSnapshotSets, userGameEndTime]);

  // Loading states
  if (loadingSimilar || loadingUser || loadingGame) {
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

  const hasData = userSnapshots && allProSnapshotsLoaded && chartData && deltaData;

  // Get selected player info for display
  const selectedPlayerName = selectedPlayerNumber === 1 ? userGame?.player1_name : userGame?.player2_name;
  const selectedPlayerRace = selectedPlayerNumber === 1 ? userGame?.player1_race : userGame?.player2_race;
  const opponentPlayerName = selectedPlayerNumber === 1 ? userGame?.player2_name : userGame?.player1_name;
  const opponentPlayerRace = selectedPlayerNumber === 1 ? userGame?.player2_race : userGame?.player1_race;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="btn-secondary">
          <ArrowLeft className="w-4 h-4 inline mr-2" />
          Back
        </button>
        <div className="flex flex-col items-center">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-sc2-blue to-sc2-purple bg-clip-text text-transparent">
            Performance Analysis
          </h2>
          {userGame && (
            <div className="flex flex-col items-center gap-2 mt-2">
              <div className="text-sm text-slate-400">
                Analyzing: <span className="text-sc2-blue font-semibold">{selectedPlayerName}</span> ({selectedPlayerRace})
                {' vs '}
                <span className="text-slate-300">{opponentPlayerName}</span> ({opponentPlayerRace})
              </div>
              {/* Player Selector */}
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedPlayerNumber(1)}
                  className={`px-4 py-1 rounded-lg text-sm font-semibold transition-all ${
                    selectedPlayerNumber === 1
                      ? 'bg-sc2-blue text-white shadow-lg shadow-sc2-blue/30'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  Player 1: {userGame.player1_name}
                </button>
                <button
                  onClick={() => setSelectedPlayerNumber(2)}
                  className={`px-4 py-1 rounded-lg text-sm font-semibold transition-all ${
                    selectedPlayerNumber === 2
                      ? 'bg-sc2-blue text-white shadow-lg shadow-sc2-blue/30'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  Player 2: {userGame.player2_name}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="w-24" />
      </div>

      {/* Game Metadata Card */}
      {userGame && userSnapshots && userSnapshots.length > 0 && (
        <GameMetadataCard
          game={userGame}
          snapshots={userSnapshots}
          playerNumber={selectedPlayerNumber}
        />
      )}

      {/* Multi-Pro Game Selector */}
      <MultiProSelector
        similarGames={similarGames}
        selectedGameIds={selectedProGameIds}
        onToggleGame={handleToggleGame}
      />

      {/* Loading state for pro games */}
      {anyProSnapshotLoading && (
        <div className="card text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-sc2-blue mx-auto mb-2" />
          <p className="text-slate-400">Loading pro game data...</p>
        </div>
      )}

      {/* Charts - only show when all data is loaded */}
      {hasData && (
        <>
          {/* Performance Overview */}
          <PerformanceRadar
            userSnapshots={userSnapshots}
            proSnapshots={calculateAverageSnapshots(proSnapshotSets)}
          />

          {/* Timeline Comparisons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TimelineChart
              data={chartData.workerData}
              title="👷 Worker Count Over Time"
              label1="You"
              label2="Pro Avg"
              color1="#00a8ff"
              color2="#ffd700"
              type="line"
              showDifference
              showProRange={selectedProGameIds.size > 1}
              showIndividualGames={selectedProGameIds.size > 1}
              proGameNames={proGameNames}
            />

            <TimelineChart
              data={chartData.armyData}
              title="⚔️ Army Value Over Time"
              label1="You"
              label2="Pro Avg"
              color1="#00a8ff"
              color2="#ffd700"
              type="area"
              showDifference
              showProRange={selectedProGameIds.size > 1}
              showIndividualGames={selectedProGameIds.size > 1}
              proGameNames={proGameNames}
            />

            <TimelineChart
              data={chartData.baseData}
              title="🏠 Base Count Over Time"
              label1="You"
              label2="Pro Avg"
              color1="#00a8ff"
              color2="#ffd700"
              type="line"
              showDifference
              showProRange={selectedProGameIds.size > 1}
              showIndividualGames={selectedProGameIds.size > 1}
              proGameNames={proGameNames}
            />

            <TimelineChart
              data={chartData.unspentData}
              title="💰 Unspent Resources Over Time"
              label1="You"
              label2="Pro Avg"
              color1="#00a8ff"
              color2="#ffd700"
              type="area"
              showDifference
              showProRange={selectedProGameIds.size > 1}
              showIndividualGames={selectedProGameIds.size > 1}
              proGameNames={proGameNames}
            />
          </div>

          {/* Comparison Matrix Table */}
          <ComparisonMatrixTable
            userSnapshots={userSnapshots}
            proSnapshotSets={proSnapshotSets}
            selectedProGameIds={Array.from(selectedProGameIds)}
            similarGames={similarGames}
          />

          {/* Cumulative Spending Charts */}
          <CumulativeSpendingCharts
            userSnapshots={userSnapshots}
            proSnapshotSets={proSnapshotSets}
          />

          {/* Build Order Timeline Comparison */}
          {buildOrderData && !loadingBuildOrder && (
            <BuildOrderComparisonTable
              userEvents={buildOrderData.user_events}
              analysis={buildOrderData.analysis}
              proEventsCount={buildOrderData.pro_events_count}
            />
          )}

          {/* Unit Composition & Strategic Analysis */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold bg-gradient-to-r from-sc2-purple to-sc2-blue bg-clip-text text-transparent">
              Milestone & Strategic Analysis
            </h2>

            {/* Milestone Timeline */}
            <MilestoneTimeline
              userSnapshots={userSnapshots}
              proSnapshotSets={proSnapshotSets}
              proGameNames={proGameNames}
              selectedProGameIds={Array.from(selectedProGameIds)}
              title="🎯 Game Milestones Timeline"
            />

            {/* Upgrade Timeline */}
            <UpgradeTimeline
              userSnapshots={userSnapshots}
              proSnapshotSets={proSnapshotSets}
              proGameNames={proGameNames}
              selectedProGameIds={Array.from(selectedProGameIds)}
              title="⬆️ Upgrade Completion Timeline"
            />

            {/* Unit Transition Analysis */}
            <UnitTransitionAnalysis
              userSnapshots={userSnapshots}
              proSnapshots={calculateAverageSnapshots(proSnapshotSets)}
              title="🔄 Composition Transitions"
            />

            {/* Strategic Tradeoff Analysis */}
            <TradeoffAnalysis
              userSnapshots={userSnapshots}
              proSnapshotSets={proSnapshotSets}
              title="🎯 Strategic Decision Analysis"
            />
          </div>

          {/* Combat Trade Analysis */}
          <CombatTradeAnalyzer
            userSnapshots={userSnapshots}
            proSnapshotSets={proSnapshotSets}
          />

          {/* Supply Block Analysis */}
          <SupplyBlockAnalyzer
            userSnapshots={userSnapshots}
            proSnapshotSets={proSnapshotSets}
            userRace={userSnapshots[0]?.race || selectedPlayerRace || 'Terran'}
          />

          {/* Win Probability Analysis */}
          <WinProbabilityPredictor
            userSnapshots={userSnapshots}
            proSnapshotSets={proSnapshotSets}
          />

          {/* Delta Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DeltaChart
              data={deltaData.workerDelta}
              title="📊 Worker Difference"
              description="Positive = ahead of pro average, Negative = behind pro average"
            />

            <DeltaChart
              data={deltaData.armyDelta}
              title="📊 Army Value Difference"
              description="Shows your resource advantage/disadvantage over time"
            />
          </div>

          {/* Key Moments */}
          <KeyMomentsPanel moments={deltaData.keyMoments} />

          {/* Summary Stats */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">📋 Summary Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: 'Avg Workers',
                  user: Math.round(userSnapshots.reduce((sum, s) => sum + s.worker_count, 0) / userSnapshots.length),
                  pro: Math.round(
                    calculateAverageSnapshots(proSnapshotSets).reduce((sum, s) => sum + s.worker_count, 0) /
                      calculateAverageSnapshots(proSnapshotSets).length
                  ),
                },
                {
                  label: 'Avg Army Value',
                  user: Math.round(
                    userSnapshots.reduce((sum, s) => sum + s.army_value_minerals + s.army_value_gas, 0) /
                      userSnapshots.length
                  ),
                  pro: Math.round(
                    calculateAverageSnapshots(proSnapshotSets).reduce(
                      (sum, s) => sum + s.army_value_minerals + s.army_value_gas,
                      0
                    ) / calculateAverageSnapshots(proSnapshotSets).length
                  ),
                },
                {
                  label: 'Avg Bases',
                  user: (
                    userSnapshots.reduce((sum, s) => sum + s.base_count, 0) / userSnapshots.length
                  ).toFixed(1),
                  pro: (
                    calculateAverageSnapshots(proSnapshotSets).reduce((sum, s) => sum + s.base_count, 0) /
                    calculateAverageSnapshots(proSnapshotSets).length
                  ).toFixed(1),
                },
                {
                  label: 'Spending Efficiency',
                  user: Math.round(
                    (userSnapshots.reduce((sum, s) => sum + s.spending_efficiency, 0) / userSnapshots.length) * 100
                  ),
                  pro: Math.round(
                    (calculateAverageSnapshots(proSnapshotSets).reduce((sum, s) => sum + s.spending_efficiency, 0) /
                      calculateAverageSnapshots(proSnapshotSets).length) *
                      100
                  ),
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
                      <div className="text-xs text-slate-500">Pro Avg</div>
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

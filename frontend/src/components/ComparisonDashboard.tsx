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
import GameOverviewHero from './GameOverviewHero';
import EditorialSectionHeader from './EditorialSectionHeader';
import CombatTradeAnalyzer from './CombatTradeAnalyzer';
import SupplyBlockAnalyzer from './SupplyBlockAnalyzer';
import WinProbabilityPredictor from './WinProbabilityPredictor';
import SectionErrorBoundary from './SectionErrorBoundary';
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

  // Memoize averaged pro snapshots — calculateAverageSnapshots is expensive (linear scan + JSON.parse)
  const avgProSnapshots = useMemo(() => {
    if (proSnapshotSets.length === 0) return [];
    return calculateAverageSnapshots(proSnapshotSets);
  }, [proSnapshotSets]);

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
    if (!userSnapshots || avgProSnapshots.length === 0) {
      return null;
    }

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
  }, [userSnapshots, avgProSnapshots, userGameEndTime]);

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
      <div className="flex items-center justify-between" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
        <button onClick={onBack} className="btn-secondary" style={{ fontSize: '16px', padding: '0.75rem 1.5rem' }}>
          <ArrowLeft className="w-5 h-5 inline mr-2" />
          Back
        </button>
        <div className="flex flex-col items-center gap-4">
          {userGame && (
            <>
              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '48px',
                letterSpacing: '0.02em',
                color: '#ffffff',
                margin: 0
              }}>
                PERFORMANCE ANALYSIS
              </h1>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '20px',
                letterSpacing: '0.05em',
                color: 'var(--ed-blue)'
              }}>
                {selectedPlayerName} ({selectedPlayerRace}) vs {opponentPlayerName} ({opponentPlayerRace})
              </div>
              {/* Player Selector */}
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedPlayerNumber(1)}
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '16px',
                    letterSpacing: '0.02em',
                    padding: '0.75rem 1.5rem',
                    border: selectedPlayerNumber === 1 ? '2px solid var(--ed-blue)' : '1px solid rgba(255,255,255,0.1)',
                    background: selectedPlayerNumber === 1 ? 'rgba(26, 143, 255, 0.1)' : 'transparent',
                    color: selectedPlayerNumber === 1 ? 'var(--ed-blue)' : 'var(--ed-gray-light)',
                    cursor: 'pointer',
                    transition: 'all 200ms ease'
                  }}
                >
                  PLAYER 1: {userGame.player1_name}
                </button>
                <button
                  onClick={() => setSelectedPlayerNumber(2)}
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '16px',
                    letterSpacing: '0.02em',
                    padding: '0.75rem 1.5rem',
                    border: selectedPlayerNumber === 2 ? '2px solid var(--ed-blue)' : '1px solid rgba(255,255,255,0.1)',
                    background: selectedPlayerNumber === 2 ? 'rgba(26, 143, 255, 0.1)' : 'transparent',
                    color: selectedPlayerNumber === 2 ? 'var(--ed-blue)' : 'var(--ed-gray-light)',
                    cursor: 'pointer',
                    transition: 'all 200ms ease'
                  }}
                >
                  PLAYER 2: {userGame.player2_name}
                </button>
              </div>
            </>
          )}
        </div>
        <div className="w-24" />
      </div>

      {/* Game Overview Hero */}
      {userGame && userSnapshots && userSnapshots.length > 0 && (
        <GameOverviewHero
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
          <SectionErrorBoundary sectionName="Performance Overview">
          <div className="ed-animate-in ed-animate-delay-1" style={{ marginTop: '4rem' }}>
            <EditorialSectionHeader
              number="01"
              title="PERFORMANCE OVERVIEW"
              subtitle="Radar chart showing overall performance across key metrics"
            />
            <div className="ed-chart-container">
              <PerformanceRadar
                userSnapshots={userSnapshots}
                proSnapshots={avgProSnapshots}
              />
            </div>
          </div>
          </SectionErrorBoundary>

          {/* Timeline Comparisons */}
          <div className="ed-animate-in ed-animate-delay-2" style={{ marginTop: '4rem' }}>
            <EditorialSectionHeader
              number="02"
              title="ECONOMY COMPARISON"
              subtitle="Worker count, army value, bases, and resource efficiency over time"
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="ed-chart-container">
                <TimelineChart
                  data={chartData.workerData}
                  title="👷 Worker Count Over Time"
                  label1="You"
                  label2="Pro Avg"
                  color1="#1a8fff"
                  color2="#ffd700"
                  type="line"
                  showDifference
                  showProRange={selectedProGameIds.size > 1}
                  showIndividualGames={selectedProGameIds.size > 1}
                  proGameNames={proGameNames}
                />
              </div>

              <div className="ed-chart-container">
                <TimelineChart
                  data={chartData.armyData}
                  title="⚔️ Army Value Over Time"
                  description="Combined mineral + gas cost of all living army units"
                  label1="You"
                  label2="Pro Avg"
                  color1="#1a8fff"
                  color2="#ffd700"
                  type="area"
                  showDifference
                  showProRange={selectedProGameIds.size > 1}
                  showIndividualGames={selectedProGameIds.size > 1}
                  proGameNames={proGameNames}
                />
              </div>

              <div className="ed-chart-container">
                <TimelineChart
                  data={chartData.baseData}
                  title="🏠 Base Count Over Time"
                  label1="You"
                  label2="Pro Avg"
                  color1="#1a8fff"
                  color2="#ffd700"
                  type="line"
                  showDifference
                  showProRange={selectedProGameIds.size > 1}
                  showIndividualGames={selectedProGameIds.size > 1}
                  proGameNames={proGameNames}
                />
              </div>

              <div className="ed-chart-container">
                <TimelineChart
                  data={chartData.unspentData}
                  title="💰 Unspent Resources Over Time"
                  description="Lower is better — unspent resources represent unused potential"
                  label1="You"
                  label2="Pro Avg"
                  color1="#1a8fff"
                  color2="#ffd700"
                  type="area"
                  showDifference
                  showProRange={selectedProGameIds.size > 1}
                  showIndividualGames={selectedProGameIds.size > 1}
                  proGameNames={proGameNames}
                />
              </div>
            </div>
          </div>

          {/* Comparison Matrix Table */}
          <SectionErrorBoundary sectionName="Comparison Matrix">
          <div className="ed-animate-in ed-animate-delay-3" style={{ marginTop: '4rem' }}>
            <EditorialSectionHeader
              number="03"
              title="COMPARISON MATRIX"
              subtitle="Side-by-side performance metrics across all selected games"
            />
            <div className="ed-chart-container">
              <ComparisonMatrixTable
                userSnapshots={userSnapshots}
                proSnapshotSets={proSnapshotSets}
                selectedProGameIds={Array.from(selectedProGameIds)}
                similarGames={similarGames}
              />
            </div>
          </div>
          </SectionErrorBoundary>

          {/* Cumulative Spending Charts */}
          <div className="ed-animate-in ed-animate-delay-4" style={{ marginTop: '4rem' }}>
            <EditorialSectionHeader
              number="04"
              title="RESOURCE SPENDING"
              subtitle="Cumulative mineral and gas spending throughout the game"
            />
            <div className="ed-chart-container">
              <CumulativeSpendingCharts
                userSnapshots={userSnapshots}
                proSnapshotSets={proSnapshotSets}
              />
            </div>
          </div>

          {/* Build Order Timeline Comparison */}
          {buildOrderData && !loadingBuildOrder && (
            <div className="ed-animate-in" style={{ marginTop: '4rem' }}>
              <EditorialSectionHeader
                number="05"
                title="BUILD ORDER TIMELINE"
                subtitle="Comparison of build order events and strategic decisions"
              />
              <div className="ed-chart-container">
                <BuildOrderComparisonTable
                  userEvents={buildOrderData.user_events}
                  analysis={buildOrderData.analysis}
                  proEventsCount={buildOrderData.pro_events_count}
                />
              </div>
            </div>
          )}

          {/* Unit Composition & Strategic Analysis */}
          <SectionErrorBoundary sectionName="Milestone & Strategic Analysis">
          <div style={{ marginTop: '6rem' }}>
            <EditorialSectionHeader
              number="06"
              title="MILESTONE & STRATEGIC ANALYSIS"
              subtitle="Game milestones, upgrades, unit transitions, and strategic decisions"
            />

            {/* Milestone Timeline */}
            <div className="ed-chart-container">
              <MilestoneTimeline
                userSnapshots={userSnapshots}
                proSnapshotSets={proSnapshotSets}
                proGameNames={proGameNames}
                selectedProGameIds={Array.from(selectedProGameIds)}
                title="🎯 Game Milestones Timeline"
              />
            </div>

            {/* Upgrade Timeline */}
            <div className="ed-chart-container">
              <UpgradeTimeline
                userSnapshots={userSnapshots}
                proSnapshotSets={proSnapshotSets}
                proGameNames={proGameNames}
                selectedProGameIds={Array.from(selectedProGameIds)}
                title="⬆️ Upgrade Completion Timeline"
              />
            </div>

            {/* Unit Transition Analysis */}
            <div className="ed-chart-container">
              <UnitTransitionAnalysis
                userSnapshots={userSnapshots}
                proSnapshots={avgProSnapshots}
                title="🔄 Composition Transitions"
              />
            </div>

            {/* Strategic Tradeoff Analysis */}
            <div className="ed-chart-container">
              <TradeoffAnalysis
                userSnapshots={userSnapshots}
                proSnapshotSets={proSnapshotSets}
                title="🎯 Strategic Decision Analysis"
              />
            </div>
          </div>
          </SectionErrorBoundary>

          {/* Combat Trade Analysis */}
          <SectionErrorBoundary sectionName="Combat Trade Analysis">
          <div style={{ marginTop: '4rem' }}>
            <EditorialSectionHeader
              number="07"
              title="COMBAT TRADE ANALYSIS"
              subtitle="Analysis of combat efficiency and army trades"
            />
            <div className="ed-chart-container">
              <CombatTradeAnalyzer
                userSnapshots={userSnapshots}
                proSnapshotSets={proSnapshotSets}
              />
            </div>
          </div>
          </SectionErrorBoundary>

          {/* Supply Block Analysis */}
          <SectionErrorBoundary sectionName="Supply Block Analysis">
          <div style={{ marginTop: '4rem' }}>
            <EditorialSectionHeader
              number="08"
              title="SUPPLY BLOCK ANALYSIS"
              subtitle="Supply cap efficiency and supply block detection"
            />
            <div className="ed-chart-container">
              <SupplyBlockAnalyzer
                userSnapshots={userSnapshots}
                proSnapshotSets={proSnapshotSets}
                userRace={userSnapshots[0]?.race || selectedPlayerRace || 'Terran'}
              />
            </div>
          </div>
          </SectionErrorBoundary>

          {/* Win Probability Analysis */}
          <SectionErrorBoundary sectionName="Win Probability">
          <div style={{ marginTop: '4rem' }}>
            <EditorialSectionHeader
              number="09"
              title="WIN PROBABILITY ANALYSIS"
              subtitle="Predicted win probability throughout the game"
            />
            <div className="ed-chart-container">
              <WinProbabilityPredictor
                userSnapshots={userSnapshots}
                proSnapshotSets={proSnapshotSets}
              />
            </div>
          </div>
          </SectionErrorBoundary>

          {/* Delta Analysis */}
          <div style={{ marginTop: '4rem' }}>
            <EditorialSectionHeader
              number="10"
              title="DELTA ANALYSIS"
              subtitle="Your performance difference compared to pro average"
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="ed-chart-container">
                <DeltaChart
                  data={deltaData.workerDelta}
                  title="📊 Worker Difference"
                  description="Positive = ahead of pro average, Negative = behind pro average"
                />
              </div>

              <div className="ed-chart-container">
                <DeltaChart
                  data={deltaData.armyDelta}
                  title="📊 Army Value Difference"
                  description="Shows your resource advantage/disadvantage over time"
                />
              </div>
            </div>
          </div>

          {/* Key Moments */}
          <div style={{ marginTop: '4rem' }}>
            <EditorialSectionHeader
              number="11"
              title="KEY MOMENTS"
              subtitle="Critical points where performance diverged significantly"
            />
            <div className="ed-chart-container">
              <KeyMomentsPanel moments={deltaData.keyMoments} />
            </div>
          </div>

          {/* Summary Stats */}
          <div style={{ marginTop: '4rem' }}>
            <EditorialSectionHeader
              number="12"
              title="SUMMARY STATISTICS"
              subtitle="Average performance metrics across the entire game"
            />
            <div className="ed-chart-container">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: 'Avg Workers',
                  user: Math.round(userSnapshots.reduce((sum, s) => sum + s.worker_count, 0) / userSnapshots.length),
                  pro: avgProSnapshots.length > 0
                    ? Math.round(
                        avgProSnapshots.reduce((sum, s) => sum + s.worker_count, 0) /
                          avgProSnapshots.length
                      )
                    : 0,
                },
                {
                  label: 'Avg Army Value',
                  user: Math.round(
                    userSnapshots.reduce((sum, s) => sum + s.army_value_minerals + s.army_value_gas, 0) /
                      userSnapshots.length
                  ),
                  pro: avgProSnapshots.length > 0
                    ? Math.round(
                        avgProSnapshots.reduce(
                          (sum, s) => sum + s.army_value_minerals + s.army_value_gas,
                          0
                        ) / avgProSnapshots.length
                      )
                    : 0,
                },
                {
                  label: 'Avg Bases',
                  user: (
                    userSnapshots.reduce((sum, s) => sum + s.base_count, 0) / userSnapshots.length
                  ).toFixed(1),
                  pro: avgProSnapshots.length > 0
                    ? (
                        avgProSnapshots.reduce((sum, s) => sum + s.base_count, 0) /
                        avgProSnapshots.length
                      ).toFixed(1)
                    : '0.0',
                },
                {
                  label: 'Spending Efficiency',
                  user: Math.round(
                    (userSnapshots.reduce((sum, s) => sum + s.spending_efficiency, 0) / userSnapshots.length) * 100
                  ),
                  pro: avgProSnapshots.length > 0
                    ? Math.round(
                        (avgProSnapshots.reduce((sum, s) => sum + s.spending_efficiency, 0) /
                          avgProSnapshots.length) *
                          100
                      )
                    : 0,
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
          </div>
        </>
      )}
    </div>
  );
}

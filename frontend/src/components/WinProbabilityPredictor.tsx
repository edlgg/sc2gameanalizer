import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Target, Activity } from 'lucide-react';
import { LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { calculateAverageSnapshots } from '../utils/formatters';
import { analyzeWinProbability, formatTime, type WinProbabilityAnalysis } from '../utils/winProbabilityAnalysis';
import type { Snapshot } from '../types';

interface WinProbabilityPredictorProps {
  userSnapshots: Snapshot[];
  proSnapshotSets?: Snapshot[][];
  avgProSnapshots?: Snapshot[];
  title?: string;
}

export default function WinProbabilityPredictor({
  userSnapshots,
  proSnapshotSets,
  avgProSnapshots: precomputedAvg,
  title = '🎯 Win Probability Analysis',
}: WinProbabilityPredictorProps) {
  // Use pre-averaged snapshots if provided, otherwise calculate from sets
  const proAvgSnapshots = useMemo(() => {
    if (precomputedAvg && precomputedAvg.length > 0) return precomputedAvg;
    if (proSnapshotSets) return calculateAverageSnapshots(proSnapshotSets);
    return [];
  }, [precomputedAvg, proSnapshotSets]);

  // Analyze win probability
  const analysis = useMemo(() => {
    return analyzeWinProbability(userSnapshots, proAvgSnapshots);
  }, [userSnapshots, proAvgSnapshots]);

  // Prepare chart data
  const chartData = useMemo(() => {
    return analysis.probabilities.map(p => ({
      time: p.time / 60, // Convert to minutes
      timeFormatted: formatTime(p.time),
      probability: p.probability * 100, // Convert to percentage
      probabilityRaw: p.probability,
    }));
  }, [analysis.probabilities]);

  if (!userSnapshots || userSnapshots.length === 0) {
    return null;
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-sc2-purple" />
            {title}
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Estimated win probability based on economic and military metrics
          </p>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<Target className="w-4 h-4" />}
          label="Final Probability"
          value={`${Math.round(analysis.finalProbability * 100)}%`}
          color={getProbabilityColor(analysis.finalProbability)}
        />

        <StatCard
          icon={<Activity className="w-4 h-4" />}
          label="Average"
          value={`${Math.round(analysis.avgProbability * 100)}%`}
          color={getProbabilityColor(analysis.avgProbability)}
        />

        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Turning Points"
          value={analysis.turningPoints.length.toString()}
          color="text-slate-300"
        />

        <StatCard
          icon={<Target className="w-4 h-4" />}
          label="Game Type"
          value={analysis.gameType.toUpperCase()}
          color={getGameTypeColor(analysis.gameType)}
        />
      </div>

      {/* Game Type Banner */}
      <div className={`p-4 rounded-lg mb-6 ${getGameTypeBgColor(analysis.gameType)}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-400">Game Classification</div>
            <div className={`text-2xl font-bold ${getGameTypeColor(analysis.gameType)}`}>
              {getGameTypeLabel(analysis.gameType)}
            </div>
            <div className="text-sm text-slate-400 mt-1">
              {getGameTypeDescription(analysis.gameType, analysis.avgProbability)}
            </div>
          </div>
          <div className="text-4xl">{getGameTypeEmoji(analysis.gameType)}</div>
        </div>
      </div>

      {/* Probability Chart */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-300 mb-3">
          📈 Win Probability Over Time
        </h4>
        <div style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="probGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="time"
                label={{ value: 'Time (minutes)', position: 'insideBottom', offset: -5, fill: '#94a3b8' }}
                stroke="#64748b"
                tick={{ fill: '#94a3b8' }}
              />
              <YAxis
                label={{ value: 'Win Probability (%)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                domain={[0, 100]}
                stroke="#64748b"
                tick={{ fill: '#94a3b8' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                }}
                formatter={(value: number | undefined) => value !== undefined ? [`${value.toFixed(1)}%`, 'Win Probability'] : ['N/A', 'Win Probability']}
                labelFormatter={(label) => {
                  const point = chartData.find(d => d.time === label);
                  return point ? point.timeFormatted : String(label);
                }}
              />
              <ReferenceLine y={50} stroke="#64748b" strokeDasharray="3 3" label={{ value: '50%', fill: '#64748b' }} />

              {/* Area fill based on gradient */}
              <Area
                type="monotone"
                dataKey="probability"
                stroke="none"
                fill="url(#probGradient)"
              />

              {/* Main probability line */}
              <Line
                type="monotone"
                dataKey="probability"
                stroke="#a855f7"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: '#a855f7' }}
              />

              {/* Mark turning points */}
              {analysis.turningPoints.map((tp, i) => {
                const dataPoint = chartData.find(d => Math.abs(d.time - tp.time / 60) < 0.1);
                if (!dataPoint) return null;
                return (
                  <ReferenceLine
                    key={i}
                    x={dataPoint.time}
                    stroke={tp.change > 0 ? '#10b981' : '#ef4444'}
                    strokeDasharray="5 5"
                    strokeWidth={2}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Turning Points */}
      {analysis.turningPoints.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">
            🎯 Key Turning Points
          </h4>
          <div className="space-y-3">
            {analysis.turningPoints.map((tp, i) => (
              <TurningPointCard key={i} turningPoint={tp} index={i + 1} />
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">💡 Key Insights</h4>
        <ul className="space-y-2 text-sm text-slate-400">
          {generateInsights(analysis).map((insight, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-sc2-purple mt-0.5">•</span>
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
  color: string;
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 text-slate-400 mb-2">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

interface TurningPointCardProps {
  turningPoint: any;
  index: number;
}

function TurningPointCard({ turningPoint, index }: TurningPointCardProps) {
  const isPositive = turningPoint.change > 0;
  const changePercent = Math.abs(turningPoint.change * 100);

  return (
    <div className={`p-3 rounded-lg border ${
      isPositive
        ? 'bg-green-500/10 border-green-500/30'
        : 'bg-red-500/10 border-red-500/30'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`text-2xl font-bold ${
            isPositive ? 'text-green-400' : 'text-red-400'
          }`}>
            #{index}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-slate-300 font-semibold">{formatTime(turningPoint.time)}</span>
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-green-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-400" />
              )}
            </div>
            <div className="text-sm text-slate-400">{turningPoint.description}</div>
            <div className="text-xs text-slate-500 mt-1">
              {Math.round(turningPoint.probabilityBefore * 100)}% → {Math.round(turningPoint.probabilityAfter * 100)}%
            </div>
          </div>
        </div>
        <div className={`text-xl font-bold ${
          isPositive ? 'text-green-400' : 'text-red-400'
        }`}>
          {isPositive ? '+' : '-'}{changePercent.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

// Helper functions

function getProbabilityColor(prob: number): string {
  if (prob > 0.7) return 'text-green-400';
  if (prob > 0.5) return 'text-emerald-400';
  if (prob > 0.3) return 'text-yellow-400';
  return 'text-red-400';
}

function getGameTypeColor(type: string): string {
  const colors = {
    dominant: 'text-green-400',
    comeback: 'text-purple-400',
    close: 'text-yellow-400',
    behind: 'text-red-400',
  };
  return colors[type as keyof typeof colors] || 'text-slate-300';
}

function getGameTypeBgColor(type: string): string {
  const colors = {
    dominant: 'bg-green-500/10 border border-green-500/30',
    comeback: 'bg-purple-500/10 border border-purple-500/30',
    close: 'bg-yellow-500/10 border border-yellow-500/30',
    behind: 'bg-red-500/10 border border-red-500/30',
  };
  return colors[type as keyof typeof colors] || 'bg-slate-800/50';
}

function getGameTypeLabel(type: string): string {
  const labels = {
    dominant: 'Dominant Victory',
    comeback: 'Comeback Victory',
    close: 'Close Game',
    behind: 'Uphill Battle',
  };
  return labels[type as keyof typeof labels] || 'Unknown';
}

function getGameTypeEmoji(type: string): string {
  const emojis = {
    dominant: '👑',
    comeback: '🔥',
    close: '⚖️',
    behind: '⚠️',
  };
  return emojis[type as keyof typeof emojis] || '🎮';
}

function getGameTypeDescription(type: string, avgProb: number): string {
  const descriptions = {
    dominant: `You maintained >80% win probability - strong performance throughout`,
    comeback: `Started behind but turned it around - resilient gameplay`,
    close: `Win probability stayed between 40-60% - evenly matched game`,
    behind: `Average probability was ${Math.round(avgProb * 100)}% - challenging game`,
  };
  return descriptions[type as keyof typeof descriptions] || '';
}

function generateInsights(analysis: WinProbabilityAnalysis): string[] {
  const insights: string[] = [];

  const { gameType, finalProbability, avgProbability, turningPoints } = analysis;

  if (gameType === 'dominant') {
    insights.push(
      'Strong performance! You maintained economic and military advantages throughout the game.'
    );
  } else if (gameType === 'comeback') {
    insights.push(
      'Impressive comeback! Despite early struggles, you recovered and secured the win.'
    );
    if (turningPoints.length > 0) {
      const biggestTP = turningPoints[0];
      insights.push(
        `The turning point was at ${formatTime(biggestTP.time)} - ${biggestTP.description.toLowerCase()}.`
      );
    }
  } else if (gameType === 'close') {
    insights.push(
      'This was a close, competitive game. Small decisions made big differences.'
    );
  } else {
    insights.push(
      'You faced significant challenges this game. Review key moments to identify improvement areas.'
    );
  }

  if (turningPoints.length >= 3) {
    insights.push(
      `Game had ${turningPoints.length} major momentum swings - volatile match with multiple key engagements.`
    );
  } else if (turningPoints.length === 0) {
    insights.push(
      'Game had steady progression without major swings - consistent execution on both sides.'
    );
  }

  if (avgProbability > 0.6 && finalProbability < 0.4) {
    insights.push(
      'You were ahead for most of the game but lost late - work on closing out advantages.'
    );
  } else if (avgProbability < 0.4 && finalProbability > 0.6) {
    insights.push(
      'You were behind most of the game but won - excellent persistence and adaptation!'
    );
  }

  return insights;
}

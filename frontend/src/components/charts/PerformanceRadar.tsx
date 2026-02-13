import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import type { Snapshot } from '../../types';

interface PerformanceRadarProps {
  userSnapshots: Snapshot[];
  proSnapshots: Snapshot[];
}

export default function PerformanceRadar({ userSnapshots, proSnapshots }: PerformanceRadarProps) {
  // Calculate average metrics from snapshots
  const calculateAverages = (snapshots: Snapshot[]) => {
    if (snapshots.length === 0) return null;

    const midGame = snapshots.filter(s => s.game_time_seconds >= 360 && s.game_time_seconds <= 720);
    if (midGame.length === 0) return null;

    const avgWorkers = midGame.reduce((sum, s) => sum + s.worker_count, 0) / midGame.length;
    const avgArmy = midGame.reduce((sum, s) => sum + (s.army_value_minerals + s.army_value_gas), 0) / midGame.length;
    const avgBases = midGame.reduce((sum, s) => sum + s.base_count, 0) / midGame.length;
    const avgSpending = midGame.reduce((sum, s) => sum + s.spending_efficiency, 0) / midGame.length;
    const avgCollection = midGame.reduce((sum, s) => sum + s.collection_efficiency, 0) / midGame.length;

    return {
      workers: avgWorkers,
      army: avgArmy,
      bases: avgBases,
      spending: avgSpending * 100,
      collection: avgCollection * 100,
    };
  };

  const userAvg = calculateAverages(userSnapshots);
  const proAvg = calculateAverages(proSnapshots);

  if (!userAvg || !proAvg) {
    return (
      <div className="chart-container">
        <h3 className="text-lg font-semibold mb-4">🎪 Performance Comparison</h3>
        <div className="h-64 flex items-center justify-center text-slate-400">
          <p>Insufficient data for comparison</p>
        </div>
      </div>
    );
  }

  // Normalize values (pro = 100%, guard against division by zero)
  const safeDivide = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0;
  const data = [
    {
      metric: 'Workers',
      You: safeDivide(userAvg.workers, proAvg.workers),
      Pro: 100,
      fullMark: 150,
    },
    {
      metric: 'Army Value',
      You: safeDivide(userAvg.army, proAvg.army),
      Pro: 100,
      fullMark: 150,
    },
    {
      metric: 'Bases',
      You: safeDivide(userAvg.bases, proAvg.bases),
      Pro: 100,
      fullMark: 150,
    },
    {
      metric: 'Spending Eff.',
      You: safeDivide(userAvg.spending, proAvg.spending),
      Pro: 100,
      fullMark: 150,
    },
    {
      metric: 'Collection Rate',
      You: safeDivide(userAvg.collection, proAvg.collection),
      Pro: 100,
      fullMark: 150,
    },
  ];

  const avgScore = Math.round(
    data.reduce((sum, d) => sum + d.You, 0) / data.length
  );

  const getScoreColor = (score: number) => {
    if (score >= 95) return 'text-green-400';
    if (score >= 80) return 'text-yellow-400';
    if (score >= 60) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 95) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Work';
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-sm font-semibold text-white mb-2">{payload[0].payload.metric}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span style={{ color: entry.color }} className="font-semibold">
                {entry.name}:
              </span>
              <span className="text-white font-bold">
                {entry.value}%
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-container">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">🎪 Performance Comparison</h3>
          <p className="text-sm text-slate-400 mt-1">
            Mid-game averages (6-12 minutes) normalized to pro performance
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-400">Overall Score</div>
          <div className={`text-3xl font-bold ${getScoreColor(avgScore)}`}>
            {avgScore}%
          </div>
          <div className={`text-sm font-semibold ${getScoreColor(avgScore)}`}>
            {getScoreLabel(avgScore)}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <RadarChart data={data}>
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fill: '#94a3b8', fontSize: 14 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 150]}
            tick={{ fill: '#64748b' }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
          />
          <Radar
            name="You"
            dataKey="You"
            stroke="#00a8ff"
            fill="#00a8ff"
            fillOpacity={0.5}
            strokeWidth={2}
            animationDuration={500}
            animationEasing="ease-in-out"
          />
          <Radar
            name="Pro"
            dataKey="Pro"
            stroke="#ffd700"
            fill="#ffd700"
            fillOpacity={0.3}
            strokeWidth={2}
            strokeDasharray="5 5"
            animationDuration={500}
            animationEasing="ease-in-out"
          />
        </RadarChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        {data.map((item) => (
          <div key={item.metric} className="stat-card">
            <div className="text-xs text-slate-400 mb-1">{item.metric}</div>
            <div className={`text-lg font-bold ${
              item.You >= 95 ? 'text-green-400' :
              item.You >= 80 ? 'text-yellow-400' :
              item.You >= 60 ? 'text-orange-400' :
              'text-red-400'
            }`}>
              {item.You}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

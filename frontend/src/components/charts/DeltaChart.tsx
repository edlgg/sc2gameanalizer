import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { DeltaPoint } from '../../types';

interface DeltaChartProps {
  data: DeltaPoint[];
  title: string;
  description?: string;
}

export default function DeltaChart({ data, title, description }: DeltaChartProps) {
  // Use the title prop to create unique gradient IDs (SVG gradient IDs are document-global)
  const gradientId = title.replace(/\s+/g, '-').toLowerCase();
  const aheadId = `ahead-${gradientId}`;
  const behindId = `behind-${gradientId}`;

  // Transform data: split difference into above-zero and below-zero for correct gradient coloring
  const chartData = data.map(point => ({
    time: point.time,
    timeFormatted: `${Math.floor(point.time / 60)}:${(point.time % 60).toString().padStart(2, '0')}`,
    difference: point.difference,
    ahead: Math.max(0, point.difference),
    behind: Math.min(0, point.difference),
    percentage: point.percentageDifference,
    isAhead: point.isAhead,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isAhead = data.difference > 0;

      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-sm text-slate-400 mb-2">{data.timeFormatted}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-300">Status:</span>
              <span className={`font-bold ${isAhead ? 'text-green-400' : 'text-red-400'}`}>
                {isAhead ? 'AHEAD' : 'BEHIND'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-300">Difference:</span>
              <span className="text-white font-semibold">
                {data.difference > 0 ? '+' : ''}{Math.round(data.difference).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-300">Percentage:</span>
              <span className="text-white font-semibold">
                {data.percentage > 0 ? '+' : ''}{data.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-container">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={aheadId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id={behindId} x1="0" y1="1" x2="0" y2="0">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="timeFormatted"
            stroke="#64748b"
            tick={{ fill: '#94a3b8' }}
          />
          <YAxis
            stroke="#64748b"
            tick={{ fill: '#94a3b8' }}
            tickFormatter={(value) => `${value > 0 ? '+' : ''}${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#64748b" strokeWidth={2} />
          {/* Green area above zero line (ahead of pro) */}
          <Area
            type="monotone"
            dataKey="ahead"
            stroke="#10b981"
            strokeWidth={2}
            fill={`url(#${aheadId})`}
            animationDuration={500}
            animationEasing="ease-in-out"
            legendType="none"
          />
          {/* Red area below zero line (behind pro) */}
          <Area
            type="monotone"
            dataKey="behind"
            stroke="#ef4444"
            strokeWidth={2}
            fill={`url(#${behindId})`}
            animationDuration={500}
            animationEasing="ease-in-out"
            legendType="none"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span className="text-slate-300">Ahead of Pro</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span className="text-slate-300">Behind Pro</span>
        </div>
      </div>
    </div>
  );
}

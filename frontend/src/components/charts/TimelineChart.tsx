import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import type { ChartDataPoint } from '../../types';

interface TimelineChartProps {
  data: ChartDataPoint[];
  title: string;
  valueKey?: string;
  valueKey2?: string;
  label1?: string;
  label2?: string;
  color1?: string;
  color2?: string;
  type?: 'line' | 'area';
  showDifference?: boolean;
  showProRange?: boolean;  // Show range band for multiple pro games
  showIndividualGames?: boolean;  // Show individual pro game lines
  proGameNames?: { [gameId: string]: string };  // Names for individual games
}

export default function TimelineChart({
  data,
  title,
  valueKey = 'value',
  label1 = 'You',
  label2 = 'Pro Avg',
  color1 = '#00a8ff',
  color2 = '#ffd700',
  type = 'line',
  showDifference = false,
  showProRange = false,
  showIndividualGames = false,
  proGameNames = {},
}: TimelineChartProps) {
  // Extract individual pro game keys from data
  const proGameKeys = Array.from(
    new Set(
      data.flatMap(d => d.proGames ? Object.keys(d.proGames) : [])
    )
  );
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl max-w-xs">
          <p className="text-sm text-slate-400 mb-2 font-semibold">{data.timeFormatted}</p>

          {/* User value */}
          <div className="flex items-center justify-between gap-4 mb-1">
            <span style={{ color: color1 }} className="font-semibold text-sm">
              {label1}:
            </span>
            <span className="text-white font-bold">
              {Math.round(data.value).toLocaleString()}
            </span>
          </div>

          {/* Pro average */}
          {data.proAvg !== undefined && (
            <div className="flex items-center justify-between gap-4 mb-1">
              <span style={{ color: color2 }} className="font-semibold text-sm">
                {label2}:
              </span>
              <span className="text-white font-bold">
                {Math.round(data.proAvg).toLocaleString()}
              </span>
            </div>
          )}

          {/* Pro range */}
          {showProRange && data.proMin !== undefined && data.proMax !== undefined && (
            <div className="text-xs text-slate-400 mb-1">
              Range: {Math.round(data.proMin).toLocaleString()} - {Math.round(data.proMax).toLocaleString()}
            </div>
          )}

          {/* Individual games (if shown) */}
          {showIndividualGames && data.proGames && (
            <div className="mt-2 pt-2 border-t border-slate-700">
              <div className="text-xs text-slate-500 mb-1">Individual Games:</div>
              {Object.entries(data.proGames).map(([gameKey, value]) => (
                <div key={gameKey} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-400 truncate">
                    {proGameNames[gameKey] || gameKey}:
                  </span>
                  <span className="text-slate-300">
                    {Math.round(value as number).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Difference */}
          {showDifference && data.proAvg !== undefined && (
            <div className="mt-2 pt-2 border-t border-slate-700">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400 text-sm">Difference:</span>
                <span className={`font-bold text-sm ${
                  data.value > data.proAvg ? 'text-green-400' : 'text-red-400'
                }`}>
                  {data.value > data.proAvg ? '+' : ''}
                  {Math.round(data.value - data.proAvg).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Use AreaChart when showing pro range (need Area component), otherwise use type-based component
  const ChartComponent = showProRange || type === 'area' ? AreaChart : LineChart;

  return (
    <div className="chart-container">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ChartComponent
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="timeFormatted"
            stroke="#64748b"
            tick={{ fill: '#94a3b8' }}
            tickFormatter={(value) => value}
          />
          <YAxis
            stroke="#64748b"
            tick={{ fill: '#94a3b8' }}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />

          {/* Pro range band (if multiple pro games selected) */}
          {showProRange && (
            <Area
              type="monotone"
              dataKey="proMax"
              stroke="none"
              fill={color2}
              fillOpacity={0.15}
              animationDuration={1500}
              animationEasing="ease-in-out"
              legendType="none"
            />
          )}
          {showProRange && (
            <Area
              type="monotone"
              dataKey="proMin"
              stroke="none"
              fill="#1e293b"
              fillOpacity={1}
              animationDuration={1500}
              animationEasing="ease-in-out"
              legendType="none"
            />
          )}

          {/* Individual pro game lines (thin, dashed, semi-transparent) */}
          {showIndividualGames && proGameKeys.map((gameKey) => (
            <Line
              key={gameKey}
              type="monotone"
              dataKey={`proGames.${gameKey}`}
              name={proGameNames[gameKey] || gameKey}
              stroke={color2}
              strokeWidth={1}
              strokeDasharray="3 3"
              strokeOpacity={0.4}
              dot={false}
              animationDuration={1500}
              animationEasing="ease-in-out"
              legendType="line"
            />
          ))}

          {/* Main lines: User and Pro Average */}
          {type === 'area' ? (
            <>
              <Area
                type="monotone"
                dataKey={valueKey}
                name={label1}
                stroke={color1}
                fill={color1}
                fillOpacity={0.3}
                strokeWidth={3}
                animationDuration={1500}
                animationEasing="ease-in-out"
              />
              <Area
                type="monotone"
                dataKey="proAvg"
                name={label2}
                stroke={color2}
                fill={color2}
                fillOpacity={0.2}
                strokeWidth={3}
                animationDuration={1500}
                animationEasing="ease-in-out"
              />
            </>
          ) : (
            <>
              <Line
                type="monotone"
                dataKey={valueKey}
                name={label1}
                stroke={color1}
                strokeWidth={3}
                dot={false}
                animationDuration={1500}
                animationEasing="ease-in-out"
              />
              <Line
                type="monotone"
                dataKey="proAvg"
                name={label2}
                stroke={color2}
                strokeWidth={3}
                dot={false}
                animationDuration={1500}
                animationEasing="ease-in-out"
              />
            </>
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}

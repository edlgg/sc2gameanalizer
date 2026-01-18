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
}

export default function TimelineChart({
  data,
  title,
  valueKey = 'value',
  valueKey2 = 'value2',
  label1 = 'You',
  label2 = 'Pro',
  color1 = '#00a8ff',
  color2 = '#ffd700',
  type = 'line',
  showDifference = false,
}: TimelineChartProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-sm text-slate-400 mb-2">{data.timeFormatted}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span style={{ color: entry.color }} className="font-semibold">
                {entry.name}:
              </span>
              <span className="text-white font-bold">
                {typeof entry.value === 'number' ? Math.round(entry.value).toLocaleString() : entry.value}
              </span>
            </div>
          ))}
          {showDifference && payload.length === 2 && (
            <div className="mt-2 pt-2 border-t border-slate-700">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400 text-sm">Difference:</span>
                <span className={`font-bold text-sm ${
                  payload[0].value > payload[1].value ? 'text-green-400' : 'text-red-400'
                }`}>
                  {payload[0].value > payload[1].value ? '+' : ''}
                  {Math.round(payload[0].value - payload[1].value).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const ChartComponent = type === 'area' ? AreaChart : LineChart;

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
          {type === 'area' ? (
            <>
              <Area
                type="monotone"
                dataKey={valueKey}
                name={label1}
                stroke={color1}
                fill={color1}
                fillOpacity={0.3}
                strokeWidth={2}
                animationDuration={1500}
                animationEasing="ease-in-out"
              />
              <Area
                type="monotone"
                dataKey={valueKey2}
                name={label2}
                stroke={color2}
                fill={color2}
                fillOpacity={0.2}
                strokeWidth={2}
                strokeDasharray="5 5"
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
                dataKey={valueKey2}
                name={label2}
                stroke={color2}
                strokeWidth={3}
                strokeDasharray="5 5"
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

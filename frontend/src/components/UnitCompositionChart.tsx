import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  extractUnitComposition,
  getUniqueUnits,
  getUnitColor,
} from '../utils/compositionAnalysis';
import type { Snapshot } from '../types';

interface UnitCompositionChartProps {
  snapshots: Snapshot[];
  title?: string;
  excludeWorkers?: boolean;
  excludeSupport?: boolean;
  maxUnits?: number;
}

export default function UnitCompositionChart({
  snapshots,
  title = '🎯 Unit Composition Over Time',
  excludeWorkers = true,
  excludeSupport = false,
  maxUnits = 10,
}: UnitCompositionChartProps) {
  // Extract composition data
  const compositionData = useMemo(() => {
    return extractUnitComposition(snapshots, excludeWorkers, excludeSupport);
  }, [snapshots, excludeWorkers, excludeSupport]);

  // Get unique unit types
  const allUnits = useMemo(() => {
    return getUniqueUnits(compositionData);
  }, [compositionData]);

  // Select top N units by total count
  const topUnits = useMemo(() => {
    const unitTotals = new Map<string, number>();

    compositionData.forEach(point => {
      Object.entries(point.units).forEach(([unitName, count]) => {
        unitTotals.set(unitName, (unitTotals.get(unitName) || 0) + count);
      });
    });

    return Array.from(unitTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxUnits)
      .map(([unitName]) => unitName);
  }, [compositionData, maxUnits]);

  // Prepare chart data with "Other" category
  const chartData = useMemo(() => {
    return compositionData.map(point => {
      const data: any = {
        time: point.time,
        timeFormatted: point.timeFormatted,
      };

      let otherCount = 0;

      Object.entries(point.units).forEach(([unitName, count]) => {
        if (topUnits.includes(unitName)) {
          data[unitName] = count;
        } else {
          otherCount += count;
        }
      });

      if (otherCount > 0) {
        data['Other'] = otherCount;
      }

      return data;
    });
  }, [compositionData, topUnits]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const sortedPayload = [...payload].sort((a, b) => b.value - a.value);
    const total = sortedPayload.reduce((sum, entry) => sum + entry.value, 0);

    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-lg">
        <p className="text-sm font-semibold text-slate-200 mb-2">{label}</p>
        <div className="space-y-1">
          {sortedPayload.map((entry: any, index: number) => {
            const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(1) : 0;
            return (
              <div key={index} className="flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-slate-300">{entry.name}:</span>
                </div>
                <span className="font-semibold text-slate-100">
                  {entry.value} ({percentage}%)
                </span>
              </div>
            );
          })}
          <div className="border-t border-slate-700 mt-2 pt-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Units:</span>
              <span className="font-semibold text-slate-200">{total}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (compositionData.length === 0 || allUnits.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="text-center py-12 text-slate-400">
          <p>No unit composition data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="text-xs text-slate-400">
          Showing top {Math.min(topUnits.length, maxUnits)} unit types
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            {topUnits.map(unitName => {
              const color = getUnitColor(unitName);
              return (
                <linearGradient key={unitName} id={`color-${unitName}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.3} />
                </linearGradient>
              );
            })}
            {/* "Other" category gradient */}
            <linearGradient id="color-Other" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#888888" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#888888" stopOpacity={0.2} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />

          <XAxis
            dataKey="timeFormatted"
            stroke="#94a3b8"
            style={{ fontSize: '12px' }}
            interval="preserveStartEnd"
          />

          <YAxis
            stroke="#94a3b8"
            style={{ fontSize: '12px' }}
            label={{ value: 'Unit Count', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{ fontSize: '12px' }}
            iconType="square"
            formatter={(value) => <span className="text-slate-300">{value}</span>}
          />

          {/* Render areas in reverse order so most common units are on bottom */}
          {[...topUnits].reverse().map(unitName => (
            <Area
              key={unitName}
              type="monotone"
              dataKey={unitName}
              stackId="1"
              stroke={getUnitColor(unitName)}
              fill={`url(#color-${unitName})`}
              strokeWidth={1}
            />
          ))}

          {/* "Other" category */}
          {chartData.some(d => d['Other'] > 0) && (
            <Area
              type="monotone"
              dataKey="Other"
              stackId="1"
              stroke="#888888"
              fill="url(#color-Other)"
              strokeWidth={1}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-4 text-xs text-slate-400">
        <p>
          💡 <strong>Tip:</strong> Hover over the chart to see exact unit counts and composition
          percentages at each moment
        </p>
      </div>
    </div>
  );
}

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Snapshot } from '../api/client';

interface TimelineChartProps {
  userSnapshots: Snapshot[];
  proSnapshots: Snapshot[];
  metric: 'worker_count' | 'army_value' | 'army_supply';
  title: string;
}

export function TimelineChart({ userSnapshots, proSnapshots, metric, title }: TimelineChartProps) {
  // Combine data for chart
  const chartData = userSnapshots.map((userSnap, i) => {
    const proSnap = proSnapshots[i] || proSnapshots[proSnapshots.length - 1];

    return {
      time: `${Math.floor(userSnap.game_time / 60)}:${(userSnap.game_time % 60).toString().padStart(2, '0')}`,
      user: userSnap[metric],
      pro: proSnap[metric],
    };
  });

  return (
    <div className="mb-8">
      <h3 className="text-xl font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="user" stroke="#3B82F6" name="You" strokeWidth={2} />
          <Line type="monotone" dataKey="pro" stroke="#F59E0B" name="Pro Average" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

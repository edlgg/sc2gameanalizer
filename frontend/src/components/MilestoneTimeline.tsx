import { useMemo } from 'react';
import { extractMilestones } from '../utils/compositionAnalysis';
import type { Snapshot } from '../types';

interface MilestoneTimelineProps {
  userSnapshots: Snapshot[];
  proSnapshotSets: Snapshot[][];
  proGameNames: { [key: string]: string };
  selectedProGameIds: number[];
  title?: string;
}

export default function MilestoneTimeline({
  userSnapshots,
  proSnapshotSets,
  proGameNames,
  selectedProGameIds,
  title = '🎯 Game Milestones Timeline',
}: MilestoneTimelineProps) {
  // Extract milestones for user and all pro games
  const userMilestones = useMemo(() => {
    return extractMilestones(userSnapshots);
  }, [userSnapshots]);

  const proMilestonesList = useMemo(() => {
    return proSnapshotSets.map((snapshots, index) => ({
      gameId: selectedProGameIds[index],
      name: proGameNames[`pro${selectedProGameIds[index]}`] || `Pro ${index + 1}`,
      milestones: extractMilestones(snapshots),
    }));
  }, [proSnapshotSets, selectedProGameIds, proGameNames]);

  // Calculate timeline bounds
  const timelineBounds = useMemo(() => {
    const allTimes: number[] = [];

    userMilestones.forEach(m => allTimes.push(m.time));
    proMilestonesList.forEach(pro => {
      pro.milestones.forEach(m => allTimes.push(m.time));
    });

    if (allTimes.length === 0) {
      return { minTime: 0, maxTime: 900, duration: 900 }; // Default 15 minutes
    }

    const minTime = 0; // Always start at 0
    const maxTime = Math.max(...allTimes);
    const duration = maxTime - minTime;

    return { minTime, maxTime, duration };
  }, [userMilestones, proMilestonesList]);

  // Format time for display
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // Get color for milestone type
  const getMilestoneColor = (type: string) => {
    switch (type) {
      case 'worker':
        return 'bg-yellow-500 border-yellow-600';
      case 'base':
        return 'bg-purple-500 border-purple-600';
      case 'building':
        return 'bg-orange-500 border-orange-600';
      case 'supply':
        return 'bg-green-500 border-green-600';
      case 'army_supply':
        return 'bg-red-500 border-red-600';
      case 'unit':
        return 'bg-cyan-500 border-cyan-600';
      default:
        return 'bg-slate-500 border-slate-600';
    }
  };

  // Calculate position on timeline (percentage)
  const getTimelinePosition = (time: number) => {
    const { minTime, duration } = timelineBounds;
    if (duration === 0) return 0;
    return ((time - minTime) / duration) * 100;
  };

  // Generate time markers (every minute)
  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    const { maxTime } = timelineBounds;

    for (let t = 0; t <= maxTime; t += 60) {
      markers.push(t);
    }

    // Add final marker if not already there
    if (markers[markers.length - 1] !== maxTime) {
      markers.push(maxTime);
    }

    return markers;
  }, [timelineBounds]);

  // Build player lanes
  const playerLanes = useMemo(() => {
    return [
      { name: 'You', milestones: userMilestones, color: 'bg-sc2-blue', textColor: 'text-sc2-blue' },
      ...proMilestonesList.map(pro => ({
        name: pro.name,
        milestones: pro.milestones,
        color: 'bg-sc2-gold',
        textColor: 'text-sc2-gold',
      })),
    ];
  }, [userMilestones, proMilestonesList]);

  if (userMilestones.length === 0 && proMilestonesList.every(p => p.milestones.length === 0)) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="text-center py-8 text-slate-400">
          <p>No milestones detected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <p className="text-sm text-slate-400 mb-6">
        Visual timeline showing when each player reached key milestones
      </p>

      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Time axis at top */}
          <div className="flex items-center mb-4 pl-32">
            <div className="flex-1 relative h-8">
              {timeMarkers.map((time, index) => (
                <div
                  key={index}
                  className="absolute top-0 flex flex-col items-center"
                  style={{ left: `${getTimelinePosition(time)}%` }}
                >
                  <div className="text-xs text-slate-500 mb-1">{formatTime(time)}</div>
                  <div className="w-px h-2 bg-slate-600"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Player lanes */}
          <div className="space-y-4">
            {playerLanes.map((lane, laneIndex) => (
              <div key={laneIndex} className="flex items-center">
                {/* Player name */}
                <div className="w-28 pr-4 text-right">
                  <span className={`text-sm font-semibold ${lane.textColor}`}>
                    {lane.name}
                  </span>
                </div>

                {/* Timeline track */}
                <div className="flex-1 relative h-12 bg-slate-800/50 rounded-lg border border-slate-700">
                  {/* Vertical grid lines */}
                  {timeMarkers.map((time, index) => (
                    <div
                      key={index}
                      className="absolute top-0 bottom-0 w-px bg-slate-700/50"
                      style={{ left: `${getTimelinePosition(time)}%` }}
                    ></div>
                  ))}

                  {/* Milestones */}
                  {lane.milestones.map((milestone, mIndex) => {
                    const position = getTimelinePosition(milestone.time);
                    const milestoneColor = getMilestoneColor(milestone.type);
                    return (
                      <div
                        key={mIndex}
                        className="absolute top-1/2 -translate-y-1/2 group cursor-pointer"
                        style={{ left: `${position}%` }}
                      >
                        {/* Milestone marker */}
                        <div
                          className={`w-8 h-8 rounded-full ${milestoneColor} flex items-center justify-center
                                     text-white text-sm font-bold border-2
                                     shadow-lg hover:scale-125 transition-transform relative z-10`}
                        >
                          {milestone.icon}
                        </div>

                        {/* Tooltip */}
                        <div
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                                     opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none
                                     bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 shadow-xl
                                     whitespace-nowrap z-20"
                        >
                          <div className="text-xs font-semibold text-slate-200 mb-1">
                            {milestone.description}
                          </div>
                          <div className="text-xs text-slate-400">
                            @ {milestone.timeFormatted}
                          </div>
                          {/* Arrow */}
                          <div
                            className="absolute top-full left-1/2 -translate-x-1/2
                                       border-4 border-transparent border-t-slate-900"
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="text-xs text-slate-400 mb-3">
              <strong>Milestone Types:</strong>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-yellow-500 border-2 border-yellow-600 flex items-center justify-center text-sm">
                  👷
                </div>
                <span>Worker Benchmarks</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-purple-500 border-2 border-purple-600 flex items-center justify-center text-sm">
                  🏠
                </div>
                <span>Base Expansion</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-orange-500 border-2 border-orange-600 flex items-center justify-center text-sm">
                  🏗️
                </div>
                <span>Key Buildings</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-500 border-2 border-green-600 flex items-center justify-center text-sm">
                  📦
                </div>
                <span>Supply Milestones</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-red-500 border-2 border-red-600 flex items-center justify-center text-sm">
                  ⚔️
                </div>
                <span>Army Supply</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-cyan-500 border-2 border-cyan-600 flex items-center justify-center text-sm">
                  🎖️
                </div>
                <span>First Units</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { Eye, Check, X, Clock, AlertTriangle } from 'lucide-react';
import {
  detectScoutingMissions,
  evaluateScouting,
  getCriticalWindows,
  calculateScoutingScore,
  compareScoutingPerformance,
  formatTime,
  type ScoutingEvaluation,
} from '../utils/scoutingAnalysis';
import type { Snapshot } from '../types';

interface ScoutingAnalyzerProps {
  userSnapshots: Snapshot[];
  proSnapshotSets: Snapshot[][];
  userRace: string;
  opponentRace: string;
  title?: string;
}

export default function ScoutingAnalyzer({
  userSnapshots,
  proSnapshotSets,
  userRace,
  opponentRace,
  title = '👁️ Scouting Intelligence Analysis',
}: ScoutingAnalyzerProps) {
  // Get critical windows for this matchup
  const criticalWindows = useMemo(() => {
    return getCriticalWindows(userRace, opponentRace);
  }, [userRace, opponentRace]);

  // Detect user scouting missions
  const userMissions = useMemo(() => {
    return detectScoutingMissions(userSnapshots);
  }, [userSnapshots]);

  // Detect pro scouting missions
  const proMissionsList = useMemo(() => {
    return proSnapshotSets.map(snapshots => detectScoutingMissions(snapshots));
  }, [proSnapshotSets]);

  // Evaluate user scouting
  const userEvaluation = useMemo(() => {
    return evaluateScouting(userMissions, proMissionsList, criticalWindows);
  }, [userMissions, proMissionsList, criticalWindows]);

  // Evaluate pro scouting (for comparison)
  const proEvaluationsList = useMemo(() => {
    return proMissionsList.map(missions =>
      evaluateScouting(missions, [missions], criticalWindows)
    );
  }, [proMissionsList, criticalWindows]);

  // Calculate scores
  const userScoreData = useMemo(() => {
    return calculateScoutingScore(userEvaluation);
  }, [userEvaluation]);

  // Compare with pros
  const comparison = useMemo(() => {
    return compareScoutingPerformance(userEvaluation, proEvaluationsList);
  }, [userEvaluation, proEvaluationsList]);

  if (!userSnapshots || userSnapshots.length === 0) {
    return null;
  }

  // Check if vision data is available
  const hasVisionData = userSnapshots.some(s => s.vision_area && s.vision_area > 0);

  if (!hasVisionData) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5 text-slate-400" />
          <h3 className="text-lg font-semibold text-slate-400">
            👁️ Scouting Intelligence Analysis
          </h3>
        </div>
        <div className="p-8 text-center bg-slate-800/30 rounded-lg border border-slate-700">
          <AlertTriangle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400 mb-2">Vision data not available for this replay</p>
          <p className="text-sm text-slate-500">
            Scouting analysis requires vision_area data which is not present in this replay.
            This feature will be available once the replay parser is updated to extract vision data.
          </p>
        </div>
      </div>
    );
  }

  const matchupDisplay = `${userRace[0]}v${opponentRace[0]}`;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Eye className="w-5 h-5 text-sc2-blue" />
            {title}
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Vision-based scouting analysis for {matchupDisplay} matchup
          </p>
        </div>
      </div>

      {/* Overall Score */}
      <div className={`p-4 rounded-lg mb-6 ${getGradeBgColor(userScoreData.grade)}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-400">Scouting Grade</div>
            <div className="flex items-center gap-3">
              <div className={`text-4xl font-bold ${getGradeTextColor(userScoreData.grade)}`}>
                {userScoreData.grade}
              </div>
              <div>
                <div className="text-lg font-semibold text-slate-300">
                  {Math.round(userScoreData.percentage)}%
                </div>
                <div className="text-xs text-slate-400">
                  {userScoreData.score.toFixed(1)} / {userScoreData.maxScore.toFixed(1)} points
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm text-slate-400 mb-1">vs Pro Average</div>
            <div className={`text-lg font-semibold ${
              comparison.scoreDiff > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {comparison.scoreDiff > 0 ? '+' : ''}{Math.round(comparison.scoreDiff)}%
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={<Eye className="w-4 h-4" />}
          label="Scouting Missions"
          value={userMissions.length.toString()}
          comparison={`Pro avg: ${
            proMissionsList.length > 0
              ? Math.round(proMissionsList.reduce((sum, m) => sum + m.length, 0) / proMissionsList.length)
              : 0
          }`}
        />

        <StatCard
          icon={<Check className="w-4 h-4" />}
          label="Windows Hit"
          value={`${userEvaluation.filter(e => e.status === 'hit').length} / ${criticalWindows.length}`}
          comparison={`${Math.round((userEvaluation.filter(e => e.status === 'hit').length / criticalWindows.length) * 100)}% success rate`}
        />

        <StatCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Missed Windows"
          value={userEvaluation.filter(e => e.status === 'missed').length.toString()}
          comparison={userEvaluation.filter(e => e.status === 'missed').length === 0 ? 'Perfect!' : 'Room for improvement'}
        />
      </div>

      {/* Critical Windows Timeline */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-300 mb-4">
          📍 Critical Scouting Windows
        </h4>
        <div className="space-y-3">
          {userEvaluation.map((evaluation, i) => (
            <WindowCard key={i} evaluation={evaluation} />
          ))}
        </div>
      </div>

      {/* Vision Activity Chart (Simple Bar Visualization) */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-slate-300 mb-3">
          👁️ Vision Activity Over Time
        </h4>
        <div className="p-4 bg-slate-800/50 rounded-lg">
          <div className="flex items-end justify-between h-24 gap-1">
            {userMissions.length > 0 ? (
              userMissions.slice(0, 20).map((mission, i) => {
                const maxVision = Math.max(...userMissions.map(m => m.visionIncrease));
                const height = (mission.visionIncrease / maxVision) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col justify-end items-center group relative">
                    <div
                      className="w-full bg-sc2-blue hover:bg-sc2-blue/80 transition-colors rounded-t"
                      style={{ height: `${height}%`, minHeight: '4px' }}
                    />
                    <div className="text-xs text-slate-500 mt-1 transform -rotate-45 origin-top-left">
                      {formatTime(mission.time)}
                    </div>
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 px-2 py-1 rounded text-xs whitespace-nowrap border border-slate-700 z-10">
                      {formatTime(mission.time)}<br />
                      +{Math.round(mission.visionIncrease)} vision
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex-1 text-center text-slate-500 text-sm">
                No significant vision spikes detected
              </div>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-2 text-center">
            Each bar represents a scouting mission (vision spike)
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <h4 className="text-sm font-semibold text-slate-300 mb-2">💡 Key Insights</h4>
        <ul className="space-y-2 text-sm text-slate-400">
          {generateInsights(userEvaluation, userScoreData, comparison, matchupDisplay).map((insight, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-sc2-blue mt-0.5">•</span>
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
  comparison: string;
}

function StatCard({ icon, label, value, comparison }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 text-slate-400 mb-2">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-2xl font-bold text-sc2-blue">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{comparison}</div>
    </div>
  );
}

interface WindowCardProps {
  evaluation: ScoutingEvaluation;
}

function WindowCard({ evaluation }: WindowCardProps) {
  const { window, status, userTime, proAvgTime, impact } = evaluation;

  const statusConfig = {
    hit: {
      icon: <Check className="w-4 h-4" />,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10 border-green-500/30',
      label: 'Hit',
    },
    late: {
      icon: <Clock className="w-4 h-4" />,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10 border-yellow-500/30',
      label: 'Late',
    },
    missed: {
      icon: <X className="w-4 h-4" />,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10 border-red-500/30',
      label: 'Missed',
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`p-3 rounded-lg border ${config.bgColor}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-slate-300">{window.label}</span>
            {window.importance === 'critical' && (
              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                CRITICAL
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 mb-2">{window.description}</div>
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-slate-500">Target: </span>
              <span className="text-slate-300 font-mono">{formatTime(window.time)}</span>
            </div>
            {userTime && (
              <div>
                <span className="text-slate-500">Actual: </span>
                <span className="text-sc2-blue font-mono">{formatTime(userTime)}</span>
              </div>
            )}
            {proAvgTime && (
              <div>
                <span className="text-slate-500">Pro avg: </span>
                <span className="text-sc2-gold font-mono">{formatTime(proAvgTime)}</span>
              </div>
            )}
          </div>
          {impact && (
            <div className="text-xs text-slate-400 mt-2 italic">
              Impact: {impact}
            </div>
          )}
        </div>
        <div className={`flex items-center gap-1 ${config.color}`}>
          {config.icon}
          <span className="text-xs font-semibold">{config.label}</span>
        </div>
      </div>
    </div>
  );
}

// Helper functions

function getGradeBgColor(grade: string): string {
  const colors = {
    A: 'bg-green-500/10 border border-green-500/30',
    B: 'bg-emerald-500/10 border border-emerald-500/30',
    C: 'bg-yellow-500/10 border border-yellow-500/30',
    D: 'bg-orange-500/10 border border-orange-500/30',
    F: 'bg-red-500/10 border border-red-500/30',
  };
  return colors[grade as keyof typeof colors] || colors.C;
}

function getGradeTextColor(grade: string): string {
  const colors = {
    A: 'text-green-400',
    B: 'text-emerald-400',
    C: 'text-yellow-400',
    D: 'text-orange-400',
    F: 'text-red-400',
  };
  return colors[grade as keyof typeof colors] || colors.C;
}

function generateInsights(
  evaluation: ScoutingEvaluation[],
  scoreData: any,
  comparison: any,
  matchup: string
): string[] {
  const insights: string[] = [];

  const missedCount = evaluation.filter(e => e.status === 'missed').length;
  const hitCount = evaluation.filter(e => e.status === 'hit').length;
  const criticalMissed = evaluation.filter(
    e => e.status === 'missed' && e.window.importance === 'critical'
  );

  if (scoreData.grade === 'A') {
    insights.push(`Excellent scouting! You hit ${hitCount} out of ${evaluation.length} critical windows.`);
  } else if (scoreData.grade === 'F') {
    insights.push(`Scouting needs major improvement. You missed ${missedCount} critical windows.`);
  }

  if (criticalMissed.length > 0) {
    const firstMissed = criticalMissed[0];
    insights.push(
      `CRITICAL: Missed "${firstMissed.window.label}" scout - ${firstMissed.impact || 'this can lose the game'}.`
    );
  }

  if (comparison.scoreDiff > 0) {
    insights.push(
      `Your scouting is ${Math.round(comparison.scoreDiff)}% better than pro average for this matchup.`
    );
  } else if (comparison.scoreDiff < -10) {
    insights.push(
      `Pros scout more effectively in ${matchup}. Focus on hitting key timing windows.`
    );
  }

  if (missedCount === 0) {
    insights.push('Perfect scouting score! You hit all critical windows.');
  } else {
    const firstMissed = evaluation.find(e => e.status === 'missed');
    if (firstMissed) {
      insights.push(
        `Prioritize the "${firstMissed.window.label}" scout at ${formatTime(firstMissed.window.time)} to gather critical intel.`
      );
    }
  }

  return insights.length > 0 ? insights : [
    'Continue practicing scouting timings for your matchup. Information wins games!'
  ];
}

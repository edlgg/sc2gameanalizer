import type { Snapshot } from '../types';

export interface ScoutingMission {
  time: number;
  visionIncrease: number;
  visionTotal: number;
}

export interface CriticalWindow {
  time: number;
  label: string;
  importance: 'high' | 'critical';
  description: string;
}

export interface ScoutingEvaluation {
  window: CriticalWindow;
  userScouted: boolean;
  userTime?: number;
  proAvgTime?: number;
  status: 'hit' | 'late' | 'missed';
  impact?: string;
}

/**
 * Define critical scouting windows by matchup
 */
export const CRITICAL_WINDOWS: Record<string, CriticalWindow[]> = {
  'TvT': [
    { time: 180, label: 'Natural Scout', importance: 'high', description: 'Check for expansion timing' },
    { time: 300, label: 'Factory/Starport Scout', importance: 'high', description: 'Identify tech path' },
    { time: 420, label: 'Pre-timing Scout', importance: 'critical', description: 'Scout before major attacks' },
  ],
  'TvP': [
    { time: 180, label: 'Gateway Count', importance: 'high', description: 'Count early gateways' },
    { time: 330, label: 'Tech Path', importance: 'critical', description: 'Robo, Stargate, or Twilight?' },
    { time: 480, label: 'Army Composition', importance: 'high', description: 'Know what units to expect' },
  ],
  'TvZ': [
    { time: 150, label: 'Pool Timing', importance: 'critical', description: 'Early pool or hatch first?' },
    { time: 240, label: 'Third Base Scout', importance: 'high', description: 'Check for greedy third' },
    { time: 360, label: 'Lair Tech Scout', importance: 'critical', description: 'Spire, Lair, or Roach Warren?' },
  ],
  'PvT': [
    { time: 180, label: 'Reaper Scout', importance: 'high', description: 'Block reaper scouting' },
    { time: 300, label: 'Factory Scout', importance: 'critical', description: 'Tanks or Hellions?' },
    { time: 420, label: 'Starport Scout', importance: 'high', description: 'Medivacs or Liberators?' },
  ],
  'PvP': [
    { time: 120, label: 'Early Gateway', importance: 'high', description: 'Proxy or standard?' },
    { time: 240, label: 'Tech Choice', importance: 'critical', description: 'Robo, Stargate, or DT?' },
    { time: 360, label: 'Army Position', importance: 'high', description: 'Preparing to attack or defend?' },
  ],
  'PvZ': [
    { time: 180, label: 'Natural Timing', importance: 'high', description: 'When does third go down?' },
    { time: 300, label: 'Lair Scout', importance: 'critical', description: 'Spire or Hydra tech?' },
    { time: 420, label: 'Drone Count', importance: 'high', description: 'How greedy is opponent?' },
  ],
  'ZvT': [
    { time: 150, label: 'CC or Rax First', importance: 'critical', description: 'Expansion timing' },
    { time: 270, label: 'Factory Timing', importance: 'high', description: 'Hellion or Tank rush?' },
    { time: 390, label: 'Starport Scout', importance: 'critical', description: 'Medivacs incoming?' },
  ],
  'ZvP': [
    { time: 180, label: 'Gateway Count', importance: 'high', description: 'Early aggression check' },
    { time: 300, label: 'Tech Path', importance: 'critical', description: 'Prepare for tech choice' },
    { time: 450, label: 'Third Base Scout', importance: 'high', description: 'Expansion timing' },
  ],
  'ZvZ': [
    { time: 120, label: 'Pool Timing', importance: 'critical', description: 'Pool first or hatch first?' },
    { time: 210, label: 'Roach Warren', importance: 'critical', description: 'Roach rush incoming?' },
    { time: 330, label: 'Spire Timing', importance: 'high', description: 'Mutas or roach/hydra?' },
  ],
};

// Default windows if matchup not found
const DEFAULT_WINDOWS: CriticalWindow[] = [
  { time: 180, label: 'Natural Scout', importance: 'high', description: 'Check expansion' },
  { time: 300, label: 'Tech Scout', importance: 'critical', description: 'Identify tech path' },
  { time: 420, label: 'Army Scout', importance: 'high', description: 'Scout army composition' },
];

/**
 * Get critical scouting windows for a specific matchup
 */
export function getCriticalWindows(userRace: string, opponentRace: string): CriticalWindow[] {
  const matchup = `${userRace[0]}v${opponentRace[0]}`; // e.g., "TvP"
  return CRITICAL_WINDOWS[matchup] || DEFAULT_WINDOWS;
}

/**
 * Detect scouting missions from vision_area spikes
 */
export function detectScoutingMissions(snapshots: Snapshot[]): ScoutingMission[] {
  const missions: ScoutingMission[] = [];

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];

    const visionIncrease = curr.vision_area - prev.vision_area;

    // Threshold: Vision increased by 10% or more = scouting mission
    // Also require absolute increase of at least 5 units to avoid noise
    if (visionIncrease > prev.vision_area * 0.1 && visionIncrease > 5) {
      missions.push({
        time: curr.game_time_seconds,
        visionIncrease,
        visionTotal: curr.vision_area,
      });
    }
  }

  return missions;
}

/**
 * Evaluate scouting performance against critical windows
 */
export function evaluateScouting(
  userMissions: ScoutingMission[],
  proMissionsList: ScoutingMission[][],
  criticalWindows: CriticalWindow[]
): ScoutingEvaluation[] {
  const evaluation: ScoutingEvaluation[] = [];

  criticalWindows.forEach(window => {
    // Find if user scouted within ±30s of window
    const userScout = userMissions.find(m =>
      Math.abs(m.time - window.time) <= 30
    );

    // Calculate pro average timing
    const proScouts = proMissionsList
      .map(missions =>
        missions.find(m => Math.abs(m.time - window.time) <= 30)
      )
      .filter(Boolean) as ScoutingMission[];

    const proAvgTime = proScouts.length > 0
      ? proScouts.reduce((sum, s) => sum + s.time, 0) / proScouts.length
      : undefined;

    let status: 'hit' | 'late' | 'missed';
    let impact: string | undefined;

    if (!userScout) {
      status = 'missed';
      impact = getImpactForMissedWindow(window);
    } else if (Math.abs(userScout.time - window.time) > 15) {
      status = 'late';
      impact = 'Scouted but timing was suboptimal';
    } else {
      status = 'hit';
    }

    evaluation.push({
      window,
      userScouted: !!userScout,
      userTime: userScout?.time,
      proAvgTime,
      status,
      impact,
    });
  });

  return evaluation;
}

/**
 * Get impact description for missed scouting window
 */
function getImpactForMissedWindow(window: CriticalWindow): string {
  const impacts: Record<string, string> = {
    'Natural Scout': 'Missed opponent expansion timing',
    'Gateway Count': 'Unprepared for early aggression',
    'Tech Path': 'Couldn\'t prepare for opponent\'s tech choice',
    'Tech Scout': 'Blind to opponent\'s strategy',
    'Pool Timing': 'Vulnerable to early all-in',
    'Factory Scout': 'Missed tank/hellion production',
    'Spire Timing': 'Caught off-guard by air units',
    'Army Composition': 'Wrong army composition',
    'Lair Tech Scout': 'Didn\'t see tech transition coming',
  };

  return impacts[window.label] || 'Missed critical information';
}

/**
 * Calculate scouting score
 */
export function calculateScoutingScore(evaluation: ScoutingEvaluation[]): {
  score: number;
  maxScore: number;
  percentage: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
} {
  const scoreMap = {
    hit: 1.0,
    late: 0.5,
    missed: 0.0,
  };

  const score = evaluation.reduce((sum, ev) => {
    const windowWeight = ev.window.importance === 'critical' ? 1.5 : 1.0;
    return sum + (scoreMap[ev.status] * windowWeight);
  }, 0);

  const maxScore = evaluation.reduce((sum, ev) => {
    const windowWeight = ev.window.importance === 'critical' ? 1.5 : 1.0;
    return sum + windowWeight;
  }, 0);

  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (percentage >= 90) grade = 'A';
  else if (percentage >= 80) grade = 'B';
  else if (percentage >= 70) grade = 'C';
  else if (percentage >= 60) grade = 'D';
  else grade = 'F';

  return { score, maxScore, percentage, grade };
}

/**
 * Compare scouting performance with pros
 */
export function compareScoutingPerformance(
  userEvaluation: ScoutingEvaluation[],
  proEvaluationsList: ScoutingEvaluation[][]
): {
  avgProScore: number;
  userScore: number;
  scoreDiff: number;
  status: 'excellent' | 'good' | 'average' | 'poor';
} {
  const userScoreData = calculateScoutingScore(userEvaluation);
  const userScore = userScoreData.percentage;

  if (proEvaluationsList.length === 0) {
    return {
      avgProScore: 0,
      userScore,
      scoreDiff: 0,
      status: 'average',
    };
  }

  const proScores = proEvaluationsList.map(evaluation =>
    calculateScoutingScore(evaluation).percentage
  );
  const avgProScore = proScores.reduce((sum, s) => sum + s, 0) / proScores.length;

  const scoreDiff = userScore - avgProScore;

  let status: 'excellent' | 'good' | 'average' | 'poor';
  if (scoreDiff > 10) status = 'excellent';
  else if (scoreDiff > -5) status = 'good';
  else if (scoreDiff > -15) status = 'average';
  else status = 'poor';

  return {
    avgProScore,
    userScore,
    scoreDiff,
    status,
  };
}

/**
 * Format seconds as MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds) % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

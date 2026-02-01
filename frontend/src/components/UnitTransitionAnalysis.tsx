import { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import {
  extractUnitComposition,
  detectCompositionTransitions,
} from '../utils/compositionAnalysis';
import type { Snapshot } from '../types';

interface UnitTransitionAnalysisProps {
  userSnapshots: Snapshot[];
  proSnapshots: Snapshot[];
  title?: string;
}

export default function UnitTransitionAnalysis({
  userSnapshots,
  proSnapshots,
  title = '🔄 Composition Transitions',
}: UnitTransitionAnalysisProps) {
  // Extract compositions
  const userComposition = useMemo(() => {
    return extractUnitComposition(userSnapshots, true, false);
  }, [userSnapshots]);

  const proComposition = useMemo(() => {
    return extractUnitComposition(proSnapshots, true, false);
  }, [proSnapshots]);

  // Detect transitions
  const userTransitions = useMemo(() => {
    return detectCompositionTransitions(userComposition, 120);
  }, [userComposition]);

  const proTransitions = useMemo(() => {
    return detectCompositionTransitions(proComposition, 120);
  }, [proComposition]);

  // Compare transition timings
  const transitionComparison = useMemo(() => {
    const comparisons: Array<{
      transition: string;
      userTime: number | null;
      proTime: number | null;
      timeDiff: number | null;
      status: 'early' | 'on-time' | 'late' | 'missing' | 'extra';
    }> = [];

    // Map pro transitions
    const proTransitionMap = new Map<string, number>();
    proTransitions.forEach(t => {
      proTransitionMap.set(t.description, t.time);
    });

    // Map user transitions
    const userTransitionMap = new Map<string, number>();
    userTransitions.forEach(t => {
      userTransitionMap.set(t.description, t.time);
    });

    // Compare
    const allTransitions = new Set([...proTransitionMap.keys(), ...userTransitionMap.keys()]);

    allTransitions.forEach(transitionDesc => {
      const userTime = userTransitionMap.get(transitionDesc) || null;
      const proTime = proTransitionMap.get(transitionDesc) || null;

      let timeDiff: number | null = null;
      let status: 'early' | 'on-time' | 'late' | 'missing' | 'extra' = 'on-time';

      if (userTime && proTime) {
        timeDiff = userTime - proTime;
        if (timeDiff < -15) status = 'early';
        else if (timeDiff > 15) status = 'late';
        else status = 'on-time';
      } else if (!userTime && proTime) {
        status = 'missing';
      } else if (userTime && !proTime) {
        status = 'extra';
      }

      comparisons.push({
        transition: transitionDesc,
        userTime,
        proTime,
        timeDiff,
        status,
      });
    });

    return comparisons.sort((a, b) => {
      const aTime = a.userTime || a.proTime || 0;
      const bTime = b.userTime || b.proTime || 0;
      return aTime - bTime;
    });
  }, [userTransitions, proTransitions]);

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'early':
        return 'text-green-400';
      case 'on-time':
        return 'text-slate-300';
      case 'late':
        return 'text-red-400';
      case 'missing':
        return 'text-orange-400';
      case 'extra':
        return 'text-blue-400';
      default:
        return 'text-slate-400';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'early':
        return 'bg-green-400/10 border-green-400/30';
      case 'on-time':
        return 'bg-slate-700/50 border-slate-600';
      case 'late':
        return 'bg-red-400/10 border-red-400/30';
      case 'missing':
        return 'bg-orange-400/10 border-orange-400/30';
      case 'extra':
        return 'bg-blue-400/10 border-blue-400/30';
      default:
        return 'bg-slate-700/50 border-slate-600';
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'early') return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (status === 'late') return <TrendingDown className="w-4 h-4 text-red-400" />;
    return null;
  };

  const getStatusLabel = (status: string, timeDiff: number | null) => {
    switch (status) {
      case 'early':
        return `${Math.abs(timeDiff!)}s early`;
      case 'on-time':
        return timeDiff ? `${Math.abs(timeDiff)}s diff` : 'On-time';
      case 'late':
        return `${Math.abs(timeDiff!)}s late`;
      case 'missing':
        return 'Not done';
      case 'extra':
        return 'Pro didn\'t do';
      default:
        return '';
    }
  };

  if (transitionComparison.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="text-center py-8 text-slate-400">
          <p>No significant composition transitions detected</p>
          <p className="text-xs mt-2">
            Transitions are detected when army composition changes by &gt;15%
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>

      <div className="space-y-3">
        {transitionComparison.map((comp, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border-2 ${getStatusBg(comp.status)}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {getStatusIcon(comp.status)}
                <span className="font-semibold text-slate-200">{comp.transition}</span>
              </div>
              <span className={`text-xs font-semibold ${getStatusColor(comp.status)}`}>
                {getStatusLabel(comp.status, comp.timeDiff)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500">Your Timing</div>
                <div className={`font-semibold ${comp.userTime ? 'text-sc2-blue' : 'text-slate-600'}`}>
                  {comp.userTime ? formatTime(comp.userTime) : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Pro Avg Timing</div>
                <div className={`font-semibold ${comp.proTime ? 'text-sc2-gold' : 'text-slate-600'}`}>
                  {comp.proTime ? formatTime(comp.proTime) : '—'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="text-xs text-slate-400 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-400/20 border border-green-400/40"></div>
            <span><strong>Early:</strong> Transitioned before pros (±15s)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-slate-700 border border-slate-600"></div>
            <span><strong>On-time:</strong> Transitioned within ±15s of pros</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-400/20 border border-red-400/40"></div>
            <span><strong>Late:</strong> Transitioned after pros (&gt;15s)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-orange-400/20 border border-orange-400/40"></div>
            <span><strong>Missing:</strong> Pros did this transition, you didn't</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-400/20 border border-blue-400/40"></div>
            <span><strong>Extra:</strong> You did this transition, pros didn't</span>
          </div>
        </div>
      </div>
    </div>
  );
}

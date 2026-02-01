import { useState, useMemo } from 'react';
import { Lightbulb } from 'lucide-react';
import { detectDecisionPoints } from '../utils/compositionAnalysis';
import DecisionPointCard from './DecisionPointCard';
import type { Snapshot } from '../types';

interface TradeoffAnalysisProps {
  userSnapshots: Snapshot[];
  proSnapshotSets: Snapshot[][];
  title?: string;
}

export default function TradeoffAnalysis({
  userSnapshots,
  proSnapshotSets,
  title = '🎯 Strategic Decision Analysis',
}: TradeoffAnalysisProps) {
  const [expandedDecisionIndex, setExpandedDecisionIndex] = useState<number | null>(null);

  // Detect decision points
  const decisionPoints = useMemo(() => {
    return detectDecisionPoints(userSnapshots, proSnapshotSets);
  }, [userSnapshots, proSnapshotSets]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    const total = decisionPoints.length;
    const goodChoices = decisionPoints.filter(d => d.outcome.winner === 'user').length;
    const proChoices = decisionPoints.filter(d => d.outcome.winner === 'pro').length;
    const neutralChoices = decisionPoints.filter(d => d.outcome.winner === 'neutral').length;

    return {
      total,
      goodChoices,
      proChoices,
      neutralChoices,
      goodPercent: total > 0 ? Math.round((goodChoices / total) * 100) : 0,
    };
  }, [decisionPoints]);

  const handleCardClick = (index: number) => {
    setExpandedDecisionIndex(expandedDecisionIndex === index ? null : index);
  };

  if (decisionPoints.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="text-center py-12 text-slate-400">
          <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No significant strategic divergences detected</p>
          <p className="text-xs mt-2">
            Decision points are identified when your choices differ significantly from pro strategy
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="stat-card">
            <div className="text-xs text-slate-400 mb-1">Total Decisions</div>
            <div className="text-2xl font-bold text-slate-200">{summary.total}</div>
          </div>

          <div className="stat-card">
            <div className="text-xs text-slate-400 mb-1">Good Choices</div>
            <div className="text-2xl font-bold text-green-400">{summary.goodChoices}</div>
          </div>

          <div className="stat-card">
            <div className="text-xs text-slate-400 mb-1">Pro Better</div>
            <div className="text-2xl font-bold text-red-400">{summary.proChoices}</div>
          </div>

          <div className="stat-card">
            <div className="text-xs text-slate-400 mb-1">Both Viable</div>
            <div className="text-2xl font-bold text-yellow-400">{summary.neutralChoices}</div>
          </div>
        </div>

        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-300">
              <Lightbulb className="w-4 h-4 inline mr-2 text-sc2-blue" />
              Decision Quality Score
            </div>
            <div className="text-lg font-bold text-slate-200">{summary.goodPercent}%</div>
          </div>
          <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all"
              style={{ width: `${summary.goodPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Decision Point Cards */}
      <div className="space-y-4">
        {decisionPoints.map((decision, index) => (
          <DecisionPointCard
            key={index}
            decision={decision}
            isExpanded={expandedDecisionIndex === index}
            onClick={() => handleCardClick(index)}
          />
        ))}
      </div>

      {/* Insights */}
      <div className="card bg-sc2-purple/5 border-sc2-purple/30">
        <h4 className="text-md font-semibold mb-3 text-slate-200">💡 Key Insights</h4>
        <div className="space-y-2 text-sm text-slate-300">
          {summary.goodChoices > summary.proChoices ? (
            <p>
              ✅ <strong>Strong decision-making:</strong> You made the right strategic calls more
              often than not. Your game sense is solid!
            </p>
          ) : summary.proChoices > summary.goodChoices ? (
            <p>
              ⚠️ <strong>Learning opportunity:</strong> Pros made different choices that led to
              better outcomes. Study these moments to improve your strategy.
            </p>
          ) : (
            <p>
              ⚪ <strong>Mixed results:</strong> Your decisions worked out sometimes. Consider the
              context of each choice (map position, scouting info, game plan).
            </p>
          )}

          <p className="text-xs text-slate-400 mt-3">
            <strong>Remember:</strong> Not all "bad" decisions are actually bad! Context matters.
            If you won despite being behind on workers, you might have better micro/engagements. If
            pros made more army but still lost, maybe the economic route was correct for your
            playstyle.
          </p>
        </div>
      </div>
    </div>
  );
}

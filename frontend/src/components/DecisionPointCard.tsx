import { CheckCircle, XCircle, MinusCircle, ArrowRight, TrendingUp, DollarSign, Home, Zap, Users, Target } from 'lucide-react';
import type { DecisionPoint } from '../utils/compositionAnalysis';

interface DecisionPointCardProps {
  decision: DecisionPoint;
  isExpanded?: boolean;
  onClick?: () => void;
}

export default function DecisionPointCard({
  decision,
  isExpanded = false,
  onClick,
}: DecisionPointCardProps) {
  const getWinnerColor = (winner: 'user' | 'pro' | 'neutral') => {
    switch (winner) {
      case 'user':
        return 'border-green-500/50 bg-green-500/5';
      case 'pro':
        return 'border-red-500/50 bg-red-500/5';
      case 'neutral':
        return 'border-yellow-500/50 bg-yellow-500/5';
    }
  };

  const getWinnerIcon = (winner: 'user' | 'pro' | 'neutral') => {
    switch (winner) {
      case 'user':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'pro':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'neutral':
        return <MinusCircle className="w-5 h-5 text-yellow-400" />;
    }
  };

  const getWinnerLabel = (winner: 'user' | 'pro' | 'neutral') => {
    switch (winner) {
      case 'user':
        return '✅ Good Choice';
      case 'pro':
        return '⚠️ Pro Approach Better';
      case 'neutral':
        return '⚪ Both Viable';
    }
  };

  const getDecisionTypeIcon = (type: DecisionPoint['decisionType']) => {
    switch (type) {
      case 'economy':
        return <DollarSign className="w-4 h-4" />;
      case 'army':
        return <Target className="w-4 h-4" />;
      case 'expansion':
        return <Home className="w-4 h-4" />;
      case 'tech':
        return <Zap className="w-4 h-4" />;
      case 'composition':
        return <Users className="w-4 h-4" />;
      case 'aggression':
        return <TrendingUp className="w-4 h-4" />;
    }
  };

  const getDecisionTypeLabel = (type: DecisionPoint['decisionType']) => {
    switch (type) {
      case 'economy':
        return 'Economy';
      case 'army':
        return 'Military';
      case 'expansion':
        return 'Expansion';
      case 'tech':
        return 'Tech Path';
      case 'composition':
        return 'Army Comp';
      case 'aggression':
        return 'Aggression';
    }
  };

  const getDecisionTypeColor = (type: DecisionPoint['decisionType']) => {
    switch (type) {
      case 'economy':
        return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'army':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'expansion':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      case 'tech':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'composition':
        return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
      case 'aggression':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    }
  };

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    const color = confidence === 'high' ? 'text-green-400' : confidence === 'medium' ? 'text-yellow-400' : 'text-slate-400';
    return (
      <span className={`text-xs ${color}`}>
        {confidence === 'high' ? '●●●' : confidence === 'medium' ? '●●○' : '●○○'}
      </span>
    );
  };

  const formatNumber = (num: number) => {
    if (Math.abs(num) >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return Math.round(num).toString();
  };

  return (
    <div
      className={`card border-2 ${getWinnerColor(decision.outcome.winner)} transition-all hover:shadow-lg ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {getWinnerIcon(decision.outcome.winner)}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-200">
                {decision.timeFormatted}
              </span>
              <span className={`text-xs font-semibold px-2 py-1 rounded border flex items-center gap-1 ${getDecisionTypeColor(decision.decisionType)}`}>
                {getDecisionTypeIcon(decision.decisionType)}
                {getDecisionTypeLabel(decision.decisionType)}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-400">
                Divergence: {Math.round(decision.divergenceScore)}%
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                Confidence: {getConfidenceBadge(decision.outcome.confidence)}
              </span>
            </div>
          </div>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-700 text-slate-300">
          {getWinnerLabel(decision.outcome.winner)}
        </span>
      </div>

      {/* Choices Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Your Choice */}
        <div className="p-3 rounded-lg bg-sc2-blue/10 border border-sc2-blue/30">
          <div className="text-xs text-slate-400 mb-1">Your Choice</div>
          <div className="text-sm font-semibold text-sc2-blue">
            {decision.userChoice.description}
          </div>
        </div>

        {/* Pro Choice */}
        <div className="p-3 rounded-lg bg-sc2-gold/10 border border-sc2-gold/30">
          <div className="text-xs text-slate-400 mb-1">Pro Choice</div>
          <div className="text-sm font-semibold text-sc2-gold">
            {decision.proChoice.description}
          </div>
        </div>
      </div>

      {/* Outcome Analysis */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRight className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-300">
              Outcome @ {decision.outcome.timeCheckedFormatted} (2.5 min later)
            </span>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="space-y-2">
              <div className="text-xs text-slate-500">Your Growth</div>
              <div className="space-y-1">
                {Object.entries(decision.outcome.userMetrics).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                    <span className="font-semibold text-sc2-blue">
                      {value >= 0 ? '+' : ''}{formatNumber(value as number)}
                      {key.includes('Growth') && key.includes('economy') ? '/min' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-slate-500">Pro Growth</div>
              <div className="space-y-1">
                {Object.entries(decision.outcome.proMetrics).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-slate-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                    <span className="font-semibold text-sc2-gold">
                      {value >= 0 ? '+' : ''}{formatNumber(value as number)}
                      {key.includes('Growth') && key.includes('economy') ? '/min' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Analysis */}
          <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <div className="text-xs text-slate-400 mb-1">Analysis</div>
            <div className="text-sm text-slate-200">{decision.outcome.analysis}</div>
          </div>
        </div>
      )}

      {/* Click hint if collapsible */}
      {onClick && !isExpanded && (
        <div className="mt-3 text-center text-xs text-slate-500">
          Click to see detailed outcome analysis →
        </div>
      )}
    </div>
  );
}

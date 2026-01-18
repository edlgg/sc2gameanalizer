import { TrendingUp, TrendingDown, Users, Swords, Home, Zap } from 'lucide-react';
import type { KeyMoment } from '../types';
import { formatNumber } from '../utils/formatters';

interface KeyMomentsPanelProps {
  moments: KeyMoment[];
}

export default function KeyMomentsPanel({ moments }: KeyMomentsPanelProps) {
  const getIcon = (type: KeyMoment['type']) => {
    switch (type) {
      case 'workers':
        return <Users className="w-5 h-5" />;
      case 'army':
        return <Swords className="w-5 h-5" />;
      case 'bases':
        return <Home className="w-5 h-5" />;
      case 'efficiency':
        return <Zap className="w-5 h-5" />;
      default:
        return <TrendingUp className="w-5 h-5" />;
    }
  };

  const getColorClass = (difference: number) => {
    if (difference > 0) return 'border-green-500/50 bg-green-500/10';
    if (difference < 0) return 'border-red-500/50 bg-red-500/10';
    return 'border-slate-600 bg-slate-800/50';
  };

  const sortedMoments = [...moments].sort((a, b) => a.time - b.time);

  if (moments.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="text-lg font-semibold mb-4">🎯 Key Moments</h3>
        <div className="text-center py-8 text-slate-400">
          <p>No significant differences detected</p>
          <p className="text-sm mt-2">Your play was very close to the pro!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <h3 className="text-lg font-semibold mb-4">🎯 Key Moments</h3>
      <p className="text-sm text-slate-400 mb-4">
        Critical points where your play differed from the pro
      </p>

      <div className="space-y-3">
        {sortedMoments.map((moment, index) => {
          const isAhead = moment.difference > 0;
          const Icon = isAhead ? TrendingUp : TrendingDown;

          return (
            <div
              key={index}
              className={`border-2 rounded-lg p-4 transition-all hover:scale-[1.02] ${getColorClass(moment.difference)}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`p-2 rounded-lg ${
                    isAhead ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {getIcon(moment.type)}
                  </div>

                  <div className="flex-1">
                    <h4 className="font-semibold text-white mb-1">{moment.title}</h4>
                    <p className={`text-sm mb-3 ${
                      isAhead ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {moment.description}
                    </p>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 text-xs mb-1">Your Value</p>
                        <p className="font-semibold text-sc2-blue">
                          {formatNumber(Math.round(moment.userValue))}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1">Pro Value</p>
                        <p className="font-semibold text-sc2-gold">
                          {formatNumber(Math.round(moment.proValue))}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={`flex flex-col items-center gap-1 ${
                  isAhead ? 'text-green-400' : 'text-red-400'
                }`}>
                  <Icon className="w-6 h-6" />
                  <span className="text-xs font-bold">
                    {isAhead ? '+' : ''}{Math.abs(moment.difference) > 1000
                      ? `${(Math.abs(moment.difference) / 1000).toFixed(1)}K`
                      : Math.round(Math.abs(moment.difference))}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

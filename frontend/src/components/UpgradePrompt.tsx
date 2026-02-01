/**
 * Upgrade prompt shown when free tier limits are reached
 */
import { Crown, Zap, Infinity, CheckCircle, X } from 'lucide-react';

interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  uploadsUsed: number;
  uploadsLimit: number;
  onUpgrade: () => void;
  priceUsd: number | null;
}

export default function UpgradePrompt({ isOpen, onClose, uploadsUsed, uploadsLimit, onUpgrade, priceUsd }: UpgradePromptProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="relative p-6 border-b border-slate-700 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Upgrade to Pro</h2>
              <p className="text-slate-400">Unlock unlimited replay analysis</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Limit reached message */}
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-200">
                  Monthly limit reached ({uploadsUsed}/{uploadsLimit} replays)
                </p>
                <p className="text-sm text-amber-200/70">
                  Your free tier resets at the start of each month
                </p>
              </div>
            </div>
          </div>

          {/* Pro benefits */}
          <div className="space-y-3 mb-6">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Pro Benefits
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-slate-300">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div className="flex items-center gap-2">
                  <Infinity className="w-4 h-4 text-sc2-blue" />
                  <span>Unlimited replay uploads</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span>Pro game comparison library</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span>Advanced analysis features</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span>All future features included</span>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-slate-800 rounded-lg p-4 mb-6">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-white">
                {priceUsd !== null ? `$${priceUsd}` : '...'}
              </span>
              <span className="text-slate-400">one-time payment</span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              No subscription, no recurring fees
            </p>
          </div>

          {/* CTA */}
          <button
            onClick={onUpgrade}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Crown className="w-5 h-5" />
            {priceUsd !== null ? `Upgrade to Pro - $${priceUsd}` : 'Upgrade to Pro'}
          </button>

          {/* Terms */}
          <p className="text-xs text-slate-500 text-center mt-4">
            Access valid as long as SC2 Replay Analyzer operates.
            <br />
            Full refund within 6 months if service discontinues.
          </p>
        </div>
      </div>
    </div>
  );
}

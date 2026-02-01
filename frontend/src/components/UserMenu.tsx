/**
 * User menu component for header
 */
import { useState, useRef, useEffect } from 'react';
import { User, LogOut, Crown, ChevronDown, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface UserMenuProps {
  onUpgradeClick: () => void;
}

export default function UserMenu({ onUpgradeClick }: UserMenuProps) {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const isPro = user.subscription_tier === 'pro';
  const uploadsRemaining = isPro ? 'Unlimited' : `${user.uploads_limit - user.uploads_used} left`;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
      >
        <div className="w-7 h-7 bg-gradient-to-br from-sc2-blue to-sc2-purple rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm text-slate-300 max-w-[120px] truncate">
          {user.email}
        </span>
        {isPro && (
          <Crown className="w-4 h-4 text-amber-500" />
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
          {/* User info */}
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              {isPro ? (
                <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 text-xs font-medium rounded border border-amber-500/30">
                  Pro
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-slate-700 text-slate-400 text-xs font-medium rounded">
                  Free
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 truncate">{user.email}</p>
          </div>

          {/* Upload stats */}
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <Upload className="w-4 h-4" />
                <span className="text-sm">Monthly uploads</span>
              </div>
              <span className={`text-sm font-medium ${isPro ? 'text-amber-400' : 'text-slate-300'}`}>
                {uploadsRemaining}
              </span>
            </div>
            {!isPro && (
              <div className="mt-2">
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sc2-blue rounded-full transition-all"
                    style={{ width: `${(user.uploads_used / user.uploads_limit) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {user.uploads_used} of {user.uploads_limit} used this month
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-2">
            {!isPro && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onUpgradeClick();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-amber-400 hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <Crown className="w-4 h-4" />
                <span className="text-sm font-medium">Upgrade to Pro</span>
              </button>
            )}
            <button
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:bg-slate-700/50 hover:text-red-400 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

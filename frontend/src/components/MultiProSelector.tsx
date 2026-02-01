import { Check } from 'lucide-react';
import type { SimilarGame } from '../types';

interface MultiProSelectorProps {
  similarGames: SimilarGame[];
  selectedGameIds: Set<number>;
  onToggleGame: (gameId: number) => void;
}

export default function MultiProSelector({
  similarGames,
  selectedGameIds,
  onToggleGame,
}: MultiProSelectorProps) {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">
        📊 Similar Pro Games - Select Multiple ({selectedGameIds.size} selected)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {similarGames.map((game) => {
          const isSelected = selectedGameIds.has(game.game_id);
          return (
            <button
              key={game.game_id}
              onClick={() => onToggleGame(game.game_id)}
              className={`p-4 rounded-lg border-2 transition-all text-left hover:scale-102 relative ${
                isSelected
                  ? 'border-sc2-blue bg-sc2-blue/10 shadow-lg shadow-sc2-blue/20'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
              }`}
            >
              {/* Checkbox indicator */}
              <div
                className={`absolute top-3 right-3 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-sc2-blue border-sc2-blue'
                    : 'border-slate-600 bg-slate-800'
                }`}
              >
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>

              <div className="flex items-center justify-between mb-2 pr-8">
                <span className="font-semibold truncate">{game.matched_player_name}</span>
                <div className="px-2 py-1 bg-sc2-gold/20 text-sc2-gold rounded text-xs font-bold">
                  {Math.round(game.similarity_score * 100)}%
                </div>
              </div>
              <div className="text-sm text-slate-400">
                {game.matched_player_race} v {game.matched_player_number === 1 ? game.player2_race : game.player1_race}
              </div>
              <div className="text-xs text-slate-500 truncate mt-1">{game.map_name}</div>
            </button>
          );
        })}
      </div>

      {selectedGameIds.size > 0 && (
        <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="text-sm text-slate-400">
            Comparing against {selectedGameIds.size} pro {selectedGameIds.size === 1 ? 'game' : 'games'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Charts show average performance with range bands
          </div>
        </div>
      )}
    </div>
  );
}

import { useGames, useDeleteGame, useDeleteAllGames } from '../hooks/useGames';
import { Loader2, Calendar, Map, Trophy, Trash2 } from 'lucide-react';
import { formatTime, getRaceColor } from '../utils/formatters';
import { useState } from 'react';

interface GameLibraryProps {
  onGameSelect: (gameId: number) => void;
}

export default function GameLibrary({ onGameSelect }: GameLibraryProps) {
  const { data: games, isLoading } = useGames({ is_pro: false });
  const deleteGameMutation = useDeleteGame();
  const deleteAllMutation = useDeleteAllGames();
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-sc2-blue" />
      </div>
    );
  }

  const handleDeleteGame = async (gameId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering game selection
    if (window.confirm('Are you sure you want to delete this replay?')) {
      await deleteGameMutation.mutateAsync(gameId);
    }
  };

  const handleDeleteAll = async () => {
    if (showDeleteAllConfirm) {
      await deleteAllMutation.mutateAsync(true); // Keep pro replays
      setShowDeleteAllConfirm(false);
    } else {
      setShowDeleteAllConfirm(true);
    }
  };

  if (!games || games.length === 0) {
    return (
      <div className="card text-center py-12">
        <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">No replays yet</h3>
        <p className="text-slate-400 mb-4">Upload your first replay to start analyzing!</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Your Replays</h2>

        {games.length > 0 && (
          <div className="flex gap-2">
            {showDeleteAllConfirm ? (
              <>
                <button
                  onClick={handleDeleteAll}
                  disabled={deleteAllMutation.isPending}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {deleteAllMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Confirm Delete All
                </button>
                <button
                  onClick={() => setShowDeleteAllConfirm(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={handleDeleteAll}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete All
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {games.map((game) => (
          <div
            key={game.id}
            className="card hover:border-sc2-blue transition-all hover:scale-[1.01] flex items-center justify-between"
          >
            <button
              onClick={() => onGameSelect(game.id)}
              className="flex-1 text-left cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getRaceColor(game.player1_race) }}
                      />
                      <span className="font-semibold">{game.player1_name}</span>
                      <span className="text-slate-400 text-sm">{game.player1_race}</span>
                    </div>

                    <span className="text-slate-500">vs</span>

                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getRaceColor(game.player2_race) }}
                      />
                      <span className="font-semibold">{game.player2_name}</span>
                      <span className="text-slate-400 text-sm">{game.player2_race}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <div className="flex items-center gap-1">
                      <Map className="w-4 h-4" />
                      <span>{game.map_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(game.game_date).toLocaleDateString()}</span>
                    </div>
                    <span>{formatTime(game.game_length_seconds)}</span>
                  </div>
                </div>

                <div
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    game.result === 1
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {game.result === 1 ? '1-0' : '0-1'}
                </div>
              </div>
            </button>

            <button
              onClick={(e) => handleDeleteGame(game.id, e)}
              disabled={deleteGameMutation.isPending}
              className="ml-4 p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors disabled:opacity-50"
              title="Delete replay"
            >
              {deleteGameMutation.isPending && deleteGameMutation.variables === game.id ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Trash2 className="w-5 h-5" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

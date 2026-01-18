import { useGames } from '../hooks/useGames';
import { Loader2, Calendar, Map, Trophy } from 'lucide-react';
import { formatTime, getRaceColor } from '../utils/formatters';

interface GameLibraryProps {
  onGameSelect: (gameId: number) => void;
}

export default function GameLibrary({ onGameSelect }: GameLibraryProps) {
  const { data: games, isLoading } = useGames({ is_pro: false });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-sc2-blue" />
      </div>
    );
  }

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
      <h2 className="text-2xl font-bold mb-6">Your Replays</h2>

      <div className="grid gap-4">
        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => onGameSelect(game.id)}
            className="card hover:border-sc2-blue cursor-pointer text-left transition-all hover:scale-[1.01]"
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
                {game.result === 1 ? 'WIN' : 'LOSS'}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

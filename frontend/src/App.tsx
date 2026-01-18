import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Upload, TrendingUp } from 'lucide-react';
import GameLibrary from './components/GameLibrary';
import ComparisonDashboard from './components/ComparisonDashboard';
import UploadZone from './components/UploadZone';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

type View = 'upload' | 'library' | 'comparison';

function App() {
  const [currentView, setCurrentView] = useState<View>('library');
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);

  const handleGameSelect = (gameId: number) => {
    setSelectedGameId(gameId);
    setCurrentView('comparison');
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {/* Header */}
        <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-sc2-blue to-sc2-purple rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">SC2 Replay Analyzer</h1>
                  <p className="text-sm text-slate-400">Compare your play to the pros</p>
                </div>
              </div>

              <nav className="flex gap-2">
                <button
                  onClick={() => setCurrentView('upload')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    currentView === 'upload'
                      ? 'bg-sc2-blue text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </button>
                <button
                  onClick={() => setCurrentView('library')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentView === 'library'
                      ? 'bg-sc2-blue text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Library
                </button>
              </nav>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          {currentView === 'upload' && (
            <div className="animate-fade-in">
              <UploadZone onUploadSuccess={(gameId) => handleGameSelect(gameId)} />
            </div>
          )}

          {currentView === 'library' && (
            <div className="animate-fade-in">
              <GameLibrary onGameSelect={handleGameSelect} />
            </div>
          )}

          {currentView === 'comparison' && selectedGameId && (
            <div className="animate-fade-in">
              <ComparisonDashboard
                gameId={selectedGameId}
                onBack={() => setCurrentView('library')}
              />
            </div>
          )}
        </main>
      </div>
    </QueryClientProvider>
  );
}

export default App;

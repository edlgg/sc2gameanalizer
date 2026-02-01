import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Upload, TrendingUp, Loader2, LogIn } from 'lucide-react';
import GameLibrary from './components/GameLibrary';
import ComparisonDashboard from './components/ComparisonDashboard';
import UploadZone from './components/UploadZone';
import AuthModal from './components/AuthModal';
import UserMenu from './components/UserMenu';
import UpgradePrompt from './components/UpgradePrompt';
import CryptoPaymentModal from './components/CryptoPaymentModal';
import LandingPage from './components/LandingPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { apiClient } from './api/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

type View = 'upload' | 'library' | 'comparison';

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('library');
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [uploadLimitInfo, setUploadLimitInfo] = useState({ used: 0, limit: 3 });
  const [priceUsd, setPriceUsd] = useState<number | null>(null);

  const { isAuthenticated, isLoading, refreshUser } = useAuth();

  // Fetch price from API
  useEffect(() => {
    apiClient.getSupportedChains()
      .then(({ price_usd }) => {
        if (price_usd) setPriceUsd(price_usd);
      })
      .catch(console.error);
  }, []);

  const handleGameSelect = (gameId: number) => {
    setSelectedGameId(gameId);
    setCurrentView('comparison');
  };

  const handleUploadLimitReached = (uploadsUsed: number, uploadsLimit: number) => {
    setUploadLimitInfo({ used: uploadsUsed, limit: uploadsLimit });
    setShowUpgradePrompt(true);
  };

  const handleUpgrade = () => {
    setShowUpgradePrompt(false);
    setShowPaymentModal(true);
  };

  const handlePaymentConfirmed = () => {
    setShowPaymentModal(false);
    refreshUser();
  };

  const openLogin = () => {
    setAuthModalMode('login');
    setShowAuthModal(true);
  };

  const openRegister = () => {
    setAuthModalMode('register');
    setShowAuthModal(true);
  };

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-sc2-blue animate-spin" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show landing page for unauthenticated users
  if (!isAuthenticated) {
    return (
      <>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          initialMode={authModalMode}
        />
        <LandingPage onLogin={openLogin} onRegister={openRegister} />
      </>
    );
  }

  // Authenticated users see the full app
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authModalMode}
      />

      {/* Upgrade Prompt */}
      <UpgradePrompt
        isOpen={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        uploadsUsed={uploadLimitInfo.used}
        uploadsLimit={uploadLimitInfo.limit}
        onUpgrade={handleUpgrade}
        priceUsd={priceUsd}
      />

      {/* Crypto Payment Modal */}
      <CryptoPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onPaymentConfirmed={handlePaymentConfirmed}
      />

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

            <div className="flex items-center gap-4">
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

              {/* Auth section */}
              {isLoading ? (
                <div className="w-8 h-8 rounded-full bg-slate-800 animate-pulse" />
              ) : isAuthenticated ? (
                <UserMenu onUpgradeClick={() => setShowPaymentModal(true)} />
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={openLogin}
                    className="px-4 py-2 rounded-lg font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </button>
                  <button
                    onClick={openRegister}
                    className="px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-sc2-blue to-sc2-purple text-white hover:opacity-90 transition-opacity"
                  >
                    Sign Up
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          {currentView === 'upload' && (
            <div className="animate-fade-in">
              <UploadZone
                onUploadSuccess={(gameId) => handleGameSelect(gameId)}
                onUploadLimitReached={handleUploadLimitReached}
                onAuthRequired={() => openLogin()}
              />
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
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

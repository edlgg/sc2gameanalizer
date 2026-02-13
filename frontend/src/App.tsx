import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import GameLibrary from './components/GameLibrary';
import ComparisonDashboard from './components/ComparisonDashboard';
import UploadZone from './components/UploadZone';
import AuthModal from './components/AuthModal';
import UpgradePrompt from './components/UpgradePrompt';
import CryptoPaymentModal from './components/CryptoPaymentModal';
import LandingPage from './components/LandingPage';
import EditorialHeader from './components/EditorialHeader';
import EditorialLayout from './components/EditorialLayout';
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
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>
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

      {/* Editorial Header */}
      <EditorialHeader
        currentView={currentView}
        onViewChange={setCurrentView}
        onUpgradeClick={() => setShowPaymentModal(true)}
      />

      {/* Main Content */}
      <EditorialLayout>
        <main style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
          {currentView === 'upload' && (
            <div className="ed-animate-in">
              <UploadZone
                onUploadSuccess={(gameId) => handleGameSelect(gameId)}
                onUploadLimitReached={handleUploadLimitReached}
                onAuthRequired={() => openLogin()}
              />
            </div>
          )}

          {currentView === 'library' && (
            <div className="ed-animate-in">
              <GameLibrary onGameSelect={handleGameSelect} />
            </div>
          )}

          {currentView === 'comparison' && selectedGameId && (
            <div className="ed-animate-in">
              <ComparisonDashboard
                gameId={selectedGameId}
                onBack={() => setCurrentView('library')}
              />
            </div>
          )}
        </main>
      </EditorialLayout>
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

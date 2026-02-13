import { Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import UserMenu from './UserMenu';

interface EditorialHeaderProps {
  currentView: 'upload' | 'library' | 'comparison';
  onViewChange: (view: 'upload' | 'library' | 'comparison') => void;
  onUpgradeClick: () => void;
}

export default function EditorialHeader({ currentView, onViewChange, onUpgradeClick }: EditorialHeaderProps) {
  const { user } = useAuth();

  // Calculate uploads used/limit
  const uploadsUsed = user?.uploads_this_month ?? 0;
  const uploadsLimit = user?.subscription_tier === 'pro' ? '∞' : '3';
  const uploadCounter = `${uploadsUsed}/${uploadsLimit} UPLOADS`;

  return (
    <header className="ed-app-header">
      <div className="ed-app-header-inner">
        {/* Logo */}
        <div className="ed-app-logo">
          <div className="ed-app-logo-text">
            SC2
            <span className="ed-app-logo-dot"></span>
          </div>
          <div className="ed-app-logo-sub">REPLAY ANALYZER</div>
        </div>

        {/* Navigation */}
        <nav className="ed-app-nav">
          <button
            onClick={() => onViewChange('upload')}
            className={`ed-app-nav-link ${currentView === 'upload' ? 'active' : ''}`}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            UPLOAD
          </button>
          <button
            onClick={() => onViewChange('library')}
            className={`ed-app-nav-link ${currentView === 'library' ? 'active' : ''}`}
          >
            LIBRARY
          </button>
        </nav>

        {/* User Section */}
        <div className="ed-app-user-section">
          <div className="ed-app-upload-counter">{uploadCounter}</div>
          <UserMenu onUpgradeClick={onUpgradeClick} />
        </div>
      </div>
    </header>
  );
}

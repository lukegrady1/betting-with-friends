import { Home, List, Upload, Trophy, BarChart3, Settings, LogOut } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface DesktopSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSettings?: () => void;
}

export function DesktopSidebar({ activeTab, onTabChange, onSettings }: DesktopSidebarProps) {
  const navigate = useNavigate();
  const { leagueId } = useParams<{ leagueId: string }>();
  
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleNavigation = (tabId: string) => {
    if (!leagueId) return;
    
    switch (tabId) {
      case 'home':
        navigate(`/leagues/${leagueId}`);
        break;
      case 'picks':
        navigate(`/leagues/${leagueId}/picks`);
        break;
      case 'upload':
        navigate(`/leagues/${leagueId}/upload`);
        break;
      case 'leaderboard':
        navigate(`/leagues/${leagueId}/leaderboard`);
        break;
      case 'analytics':
        navigate(`/leagues/${leagueId}/analytics`);
        break;
      default:
        onTabChange(tabId);
    }
  };

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'upload', label: 'Upload Slips', icon: Upload },
    { id: 'picks', label: 'My Picks', icon: List },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="desktop-sidebar-container">
      <div className="desktop-sidebar-content">
        {/* Logo/Brand */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 px-6">Betting with Friends</h2>
        </div>

        {/* Navigation */}
        <nav className="space-y-2 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.id)}
                className={`
                  w-full flex items-center px-6 py-3 text-left transition-colors duration-200
                  ${isActive 
                    ? 'bg-gray-100 text-gray-900 border-r-2 border-gray-900' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <Icon size={18} className="mr-3" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="space-y-1 pt-4 border-t border-gray-200">
          {onSettings && (
            <button
              onClick={onSettings}
              className="w-full flex items-center px-6 py-3 text-left text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-200"
            >
              <Settings size={18} className="mr-3" />
              <span className="font-medium">Settings</span>
            </button>
          )}
          
          <button
            onClick={handleSignOut}
            className="w-full flex items-center px-6 py-3 text-left text-red-600 hover:bg-red-50 transition-colors duration-200"
          >
            <LogOut size={18} className="mr-3" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
import React from 'react';
import { Home, List, Calendar, Trophy, Settings, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface DesktopSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSettings?: () => void;
}

export function DesktopSidebar({ activeTab, onTabChange, onSettings }: DesktopSidebarProps) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'picks', label: 'My Picks', icon: List },
    { id: 'events', label: 'Events', icon: Calendar },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  ];

  return (
    <div className="desktop-sidebar-container">
      <div className="desktop-sidebar-content">
        {/* Logo/Brand */}
        <div className="mb-12">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-3xl mx-auto mb-4 flex items-center justify-center shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
            <span className="text-2xl font-bold text-white relative z-10">🎲</span>
          </div>
          <h2 className="text-lg font-bold text-center text-premium">Betting with Friends</h2>
        </div>

        {/* Navigation */}
        <nav className="space-y-2 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`
                  w-full flex items-center px-6 py-4 text-left rounded-2xl transition-all duration-300 group
                  ${isActive 
                    ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-600 shadow-lg shadow-blue-500/25 border-2 border-blue-200' 
                    : 'text-neutral-600 hover:bg-white/50 hover:text-neutral-900 hover:shadow-md'
                  }
                `}
              >
                <div className={`
                  w-10 h-10 rounded-xl flex items-center justify-center mr-4 transition-all duration-300
                  ${isActive 
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50' 
                    : 'bg-neutral-100 group-hover:bg-neutral-200 group-hover:scale-110'
                  }
                `}>
                  <Icon size={18} />
                </div>
                <span className="font-semibold text-base">{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-2 h-2 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50"></div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="space-y-2 pt-6 border-t border-neutral-200">
          {onSettings && (
            <button
              onClick={onSettings}
              className="w-full flex items-center px-6 py-4 text-left rounded-2xl text-neutral-600 hover:bg-white/50 hover:text-neutral-900 transition-all duration-300 group"
            >
              <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center mr-4 group-hover:bg-neutral-200 group-hover:scale-110 transition-all duration-300">
                <Settings size={18} />
              </div>
              <span className="font-semibold text-base">Settings</span>
            </button>
          )}
          
          <button
            onClick={handleSignOut}
            className="w-full flex items-center px-6 py-4 text-left rounded-2xl text-red-600 hover:bg-red-50 transition-all duration-300 group"
          >
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mr-4 group-hover:bg-red-200 group-hover:scale-110 transition-all duration-300">
              <LogOut size={18} />
            </div>
            <span className="font-semibold text-base">Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
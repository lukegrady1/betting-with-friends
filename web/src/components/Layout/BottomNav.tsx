import React from 'react';
import { Home, List, Calendar, Trophy } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'picks', icon: List, label: 'Picks' },
  { id: 'events', icon: Calendar, label: 'Events' },
  { id: 'board', icon: Trophy, label: 'Board' },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="mobile-nav px-4 py-2">
      <div className="flex justify-around max-w-md mx-auto">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex flex-col items-center py-2 px-3 relative transition-colors duration-200 min-w-0 ${
              activeTab === id 
                ? 'text-primary' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {activeTab === id && (
              <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
            )}
            <Icon size={20} className="mb-1" strokeWidth={activeTab === id ? 2.5 : 2} />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
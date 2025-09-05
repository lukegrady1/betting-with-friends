import React from 'react';
import { ArrowLeft, Settings, Plus } from 'lucide-react';

interface TopBarProps {
  title: string;
  onBack?: () => void;
  onSettings?: () => void;
  onAdd?: () => void;
  rightAction?: React.ReactNode;
}

export function TopBar({ title, onBack, onSettings, onAdd, rightAction }: TopBarProps) {
  return (
    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b px-4 py-4 supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between max-w-md mx-auto">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 -ml-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-all duration-200 focus-ring"
            >
              <ArrowLeft size={20} strokeWidth={2.5} />
            </button>
          )}
          <h1 className="text-xl font-bold text-foreground truncate">
            {title}
          </h1>
        </div>
        
        <div className="flex items-center space-x-1">
          {onAdd && (
            <button
              onClick={onAdd}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-all duration-200 focus-ring"
            >
              <Plus size={20} strokeWidth={2.5} />
            </button>
          )}
          {onSettings && (
            <button
              onClick={onSettings}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-all duration-200 focus-ring"
            >
              <Settings size={20} strokeWidth={2.5} />
            </button>
          )}
          {rightAction}
        </div>
      </div>
    </header>
  );
}
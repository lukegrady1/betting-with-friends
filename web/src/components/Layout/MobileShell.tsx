import React from 'react';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { DesktopSidebar } from './DesktopSidebar';

interface MobileShellProps {
  children: React.ReactNode;
  title?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onBack?: () => void;
  onSettings?: () => void;
  onAdd?: () => void;
  rightAction?: React.ReactNode;
  showBottomNav?: boolean;
  showDesktopSidebar?: boolean;
}

export function MobileShell({
  children,
  title = 'Betting with Friends',
  activeTab = 'home',
  onTabChange = () => {},
  onBack,
  onSettings,
  onAdd,
  rightAction,
  showBottomNav = true,
  showDesktopSidebar = false,
}: MobileShellProps) {
  return (
    <div className="page-container">
      {/* Mobile Layout */}
      <div className="md:hidden flex flex-col min-h-screen">
        <TopBar 
          title={title}
          onBack={onBack}
          onSettings={onSettings}
          onAdd={onAdd}
          rightAction={rightAction}
        />
        
        <main className={`flex-1 overflow-y-auto ${showBottomNav ? 'pb-24' : 'pb-6'}`}>
          <div className="max-w-md mx-auto px-4">
            {children}
          </div>
        </main>
        
        {showBottomNav && (
          <BottomNav 
            activeTab={activeTab}
            onTabChange={onTabChange}
          />
        )}
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:block">
        <div className="desktop-container">
          {showDesktopSidebar && (
            <div className="desktop-sidebar">
              <DesktopSidebar 
                activeTab={activeTab}
                onTabChange={onTabChange}
                onSettings={onSettings}
              />
            </div>
          )}
          
          <main className="desktop-main w-full">
            <div className="w-full h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
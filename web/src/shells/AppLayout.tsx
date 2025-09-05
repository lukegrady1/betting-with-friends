import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { TopBar } from "../components/Layout/TopBar";
import { BottomNav } from "../components/Layout/BottomNav";

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = location.pathname.includes('/picks') ? 'picks' 
                  : location.pathname.includes('/events') ? 'events'
                  : location.pathname.includes('/leaderboard') ? 'board'
                  : 'home';

  const handleTabChange = (tab: string) => {
    switch (tab) {
      case 'picks':
        navigate('/leagues'); // Navigate to leagues picks
        break;
      case 'events':
        navigate('/leagues'); // Navigate to leagues events  
        break;
      case 'board':
        navigate('/leagues'); // Navigate to leagues leaderboard
        break;
      default:
        navigate('/leagues');
    }
  };

  return (
    <div className="min-h-dvh">
      <TopBar title="Betting with Friends" />
      <main className="container-responsive pb-20">
        <Outlet />
      </main>
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
}
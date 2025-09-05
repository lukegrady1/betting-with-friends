import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { TopBar } from "../components/Layout/TopBar";
import { BottomNav } from "../components/Layout/BottomNav";

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract leagueId from current path if present
  const leagueIdMatch = location.pathname.match(/\/leagues\/([^\/]+)/);
  const currentLeagueId = leagueIdMatch ? leagueIdMatch[1] : null;

  const activeTab = location.pathname.includes('/picks') ? 'picks' 
                  : location.pathname.includes('/events') ? 'events'
                  : location.pathname.includes('/leaderboard') ? 'board'
                  : 'home';

  const handleTabChange = (tab: string) => {
    if (!currentLeagueId) {
      // If no league is active, go to leagues page
      navigate('/leagues');
      return;
    }

    switch (tab) {
      case 'picks':
        navigate(`/leagues/${currentLeagueId}/picks`);
        break;
      case 'events':
        navigate(`/leagues/${currentLeagueId}/events`);
        break;
      case 'board':
        navigate(`/leagues/${currentLeagueId}/leaderboard`);
        break;
      case 'home':
        navigate(`/leagues/${currentLeagueId}`);
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
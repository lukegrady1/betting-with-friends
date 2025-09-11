import { createBrowserRouter } from "react-router-dom";
import { AuthProvider } from "./App";
import { AppLayout } from "./shells/AppLayout";
import { AuthLayout } from "./shells/AuthLayout";
import SignInPage from "./routes/auth/SignInPage";
import { Callback } from "./routes/auth/Callback";
import { LeaguesPage } from "./routes/leagues/LeaguesPage";
import { CreateLeaguePage } from "./routes/leagues/CreateLeaguePage";
import { JoinLeaguePage } from "./routes/leagues/JoinLeaguePage";
import { LeagueHomePage } from "./routes/leagues/LeagueHomePage";
import { PicksPage } from "./routes/leagues/PicksPage";
import { SlipUploadPage } from "./routes/leagues/SlipUploadPage";
import { LeaderboardPage } from "./routes/leagues/LeaderboardPage";
import { AnalyticsPage } from "./routes/leagues/AnalyticsPage";
import { SettingsPage } from "./routes/leagues/SettingsPage";

const basename = import.meta.env.PROD ? '/betting-with-friends' : '';

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AuthProvider><AppLayout/></AuthProvider>,
    children: [
      { index: true, element: <LeaguesPage/> },
      { path: "leagues", element: <LeaguesPage/> },
      { path: "leagues/create", element: <CreateLeaguePage/> },
      { path: "leagues/join", element: <JoinLeaguePage/> },
      { path: "leagues/:leagueId", element: <LeagueHomePage/> },
      { path: "leagues/:leagueId/upload", element: <SlipUploadPage/> },
      { path: "leagues/:leagueId/picks", element: <PicksPage/> },
      { path: "leagues/:leagueId/leaderboard", element: <LeaderboardPage/> },
      { path: "leagues/:leagueId/analytics", element: <AnalyticsPage/> },
      { path: "leagues/:leagueId/settings", element: <SettingsPage/> },
    ],
  },
  { 
    path: "/auth/signin", 
    element: <AuthProvider><AuthLayout><SignInPage/></AuthLayout></AuthProvider> 
  },
  { 
    path: "/auth/callback", 
    element: <AuthProvider><AuthLayout><Callback/></AuthLayout></AuthProvider> 
  },
  {
    path: "*",
    element: <AuthProvider><AuthLayout><SignInPage/></AuthLayout></AuthProvider>
  }
], { basename });
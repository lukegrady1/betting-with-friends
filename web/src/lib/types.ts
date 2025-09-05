// Database types for the betting app

export interface Profile {
  id: string;
  username: string | null;
  created_at: string;
}

export type League = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export interface LeagueMember {
  league_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface Event {
  id: string;
  league_id: string;
  sport: string;
  league_name: string | null;
  home_team: string;
  away_team: string;
  start_time: string;
  status: 'scheduled' | 'final' | 'canceled';
  home_score: number | null;
  away_score: number | null;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface Pick {
  id: string;
  league_id: string;
  event_id: string;
  user_id: string;
  market: 'moneyline' | 'spread' | 'total';
  side: string;
  line: number | null;
  odds_american: number;
  units_staked: number;
  result: 'pending' | 'win' | 'loss' | 'push' | 'void';
  profit_units: number;
  created_at: string;
  updated_at?: string;
}

export interface PickVisible extends Pick {
  market: string; // 'hidden' when not visible
  side: string | null;
  line: number | null;
  odds_american: number | null;
  units_staked: number | null;
}

export interface LeagueUserStats {
  league_id: string;
  user_id: string;
  graded: number;
  wins: number;
  losses: number;
  pushes: number;
  win_pct: number | null;
  units_risked: number | null;
  net_units: number | null;
}

export interface PickWithEvent extends PickVisible {
  events: Event;
}

export interface LeaderboardEntry extends LeagueUserStats {
  profiles: Profile;
}
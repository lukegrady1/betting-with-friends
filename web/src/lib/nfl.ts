// NFL-specific utility functions

export function getCurrentNFLSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // JavaScript months are 0-indexed
  
  // NFL season runs from September to February of the following year
  // If it's January-February, we're in the previous year's season
  // If it's March-August, we're in the off-season (use previous completed season for testing)
  // If it's September-December, we're in the current year's season
  
  if (month >= 1 && month <= 2) {
    return year - 1; // e.g., January 2025 is part of the 2024 season
  } else if (month >= 3 && month <= 8) {
    return year - 1; // Off-season, use previous completed season for testing
  } else {
    // For testing purposes, if we're in a future year that doesn't have data, use 2024
    return year >= 2025 ? 2024 : year; // September-December, current season or 2024 for testing
  }
}

export function getCurrentNFLWeek(): number {
  const now = new Date();
  const season = getCurrentNFLSeason();
  
  // Rough estimation - NFL season typically starts first Thursday after Labor Day
  // This is a simplified calculation, in production you'd want more precise dates
  const seasonStart = new Date(season, 8, 1); // September 1st as rough start
  
  // Find first Thursday of September
  while (seasonStart.getDay() !== 4) { // 4 = Thursday
    seasonStart.setDate(seasonStart.getDate() + 1);
  }
  
  const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
  
  // Regular season is weeks 1-18
  return Math.max(1, Math.min(18, weeksSinceStart + 1));
}

export function useSeasonWeek(): [number, number] {
  // In a real app, you might want to make this configurable or get from URL params
  return [getCurrentNFLSeason(), getCurrentNFLWeek()];
}

export function formatKickoff(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

// Team name mappings for better display
export const NFL_TEAM_NAMES: Record<string, string> = {
  'ARI': 'Cardinals',
  'ATL': 'Falcons', 
  'BAL': 'Ravens',
  'BUF': 'Bills',
  'CAR': 'Panthers',
  'CHI': 'Bears',
  'CIN': 'Bengals',
  'CLE': 'Browns',
  'DAL': 'Cowboys',
  'DEN': 'Broncos',
  'DET': 'Lions',
  'GB': 'Packers',
  'HOU': 'Texans',
  'IND': 'Colts',
  'JAC': 'Jaguars',
  'KC': 'Chiefs',
  'LV': 'Raiders',
  'LAC': 'Chargers',
  'LAR': 'Rams',
  'MIA': 'Dolphins',
  'MIN': 'Vikings',
  'NE': 'Patriots',
  'NO': 'Saints',
  'NYG': 'Giants',
  'NYJ': 'Jets',
  'PHI': 'Eagles',
  'PIT': 'Steelers',
  'SF': '49ers',
  'SEA': 'Seahawks',
  'TB': 'Buccaneers',
  'TEN': 'Titans',
  'WAS': 'Commanders'
};

export function formatTeamName(teamCode: string): string {
  return NFL_TEAM_NAMES[teamCode] || teamCode;
}
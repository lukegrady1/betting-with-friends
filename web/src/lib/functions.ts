// Client utilities for calling Supabase Edge Functions

export async function syncWeek({ 
  season, 
  week, 
  leagueId 
}: { 
  season: number; 
  week: number; 
  leagueId: string;
}) {
  const base = import.meta.env.VITE_PUBLIC_FUNCTIONS_URL;
  if (!base) {
    throw new Error('VITE_PUBLIC_FUNCTIONS_URL environment variable is not set');
  }

  const url = `${base}/nfl-sync-week?season=${season}&week=${week}&leagueId=${leagueId}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || errorData.message || 'Failed to sync NFL events');
  }
  
  return response.json();
}
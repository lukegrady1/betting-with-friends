// Client utilities for calling Supabase Edge Functions
import { supabase } from './supabase';

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

  // Get the current session for authentication
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Authentication required');
  }

  const url = `${base}/nfl-sync-week?season=${season}&week=${week}&leagueId=${leagueId}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || errorData.message || 'Failed to sync NFL events');
  }
  
  return response.json();
}

export async function syncSeason({ season, leagueId }: { season: number; leagueId?: string }) {
  const base = import.meta.env.VITE_PUBLIC_FUNCTIONS_URL;
  if (!base) {
    throw new Error('VITE_PUBLIC_FUNCTIONS_URL environment variable is not set');
  }

  const u = new URL(`${base}/nfl-schedules`);
  u.searchParams.set("season", String(season));
  if (leagueId) u.searchParams.set("league_id", leagueId);
  u.searchParams.set("mode", "upsert");
  
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
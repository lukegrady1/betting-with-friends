// Deno runtime (Supabase Edge Functions)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // for DB writes
const SPORTSDATA_KEY = Deno.env.get("SPORTSDATAIO_API_KEY")!;

const SCORES_BASE = "https://api.sportsdata.io/v3/nfl/scores/json";

async function fetchJson(url: string) {
  const r = await fetch(url, { headers: { "Ocp-Apim-Subscription-Key": SPORTSDATA_KEY } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const { searchParams } = new URL(req.url);
    const season = Number(searchParams.get("season"));
    const week = Number(searchParams.get("week"));
    const leagueId = searchParams.get("leagueId");
    
    if (!season || !week || !leagueId) {
      return new Response("Missing season, week, or leagueId", { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if we've synced recently to avoid rate limits (within last hour)
    const { data: lastSync } = await supabase
      .from("sync_log")
      .select("last_synced_at")
      .eq("league_id", leagueId)
      .eq("season", season)
      .eq("week", week)
      .single();

    if (lastSync) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (new Date(lastSync.last_synced_at) > hourAgo) {
        return new Response(
          JSON.stringify({ error: "Already synced within the last hour" }), 
          { status: 429 }
        );
      }
    }

    // Fetch NFL data from SportsDataIO
    const [games, stadiums] = await Promise.all([
      fetchJson(`${SCORES_BASE}/GamesByWeek/${season}/${week}`),
      fetchJson(`${SCORES_BASE}/Stadiums`),
    ]);
    
    const stadiumById = new Map<number, any>(stadiums.map((s: any) => [s.StadiumID, s]));

    const rows = games.map((g: any) => {
      const s = stadiumById.get(g.StadiumID) || g.StadiumDetails || {};
      return {
        league_id: leagueId,
        external_provider: "sportsdataio",
        external_id: String(g.GameKey ?? g.GameID),
        sport: "NFL",
        league_name: "NFL",
        season,
        week,
        home_team: g.HomeTeam,         // 3-letter code
        away_team: g.AwayTeam,
        start_time: g.Date,            // ISO; store as timestamptz
        status: g.Status ?? "scheduled",
        venue_name: s.Name ?? null,
        venue_city: s.City ?? null,
        venue_state: s.State ?? null,
        created_by: null,              // system insert
      };
    });

    // Upsert events - first try to match by external_provider + external_id + league_id
    const { data, error } = await supabase
      .from("events")
      .upsert(rows, { 
        onConflict: "external_provider,external_id,league_id",
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error("Error upserting events:", error);
      throw error;
    }

    // Update sync log
    await supabase
      .from("sync_log")
      .upsert(
        { league_id: leagueId, season, week, last_synced_at: new Date().toISOString() },
        { onConflict: "league_id,season,week" }
      );

    return new Response(JSON.stringify({ 
      success: true,
      count: data?.length ?? 0, 
      events: data,
      message: `Synced ${data?.length ?? 0} events for week ${week} of ${season} season`
    }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("NFL sync error:", e);
    return new Response(JSON.stringify({ 
      error: String(e),
      message: "Failed to sync NFL events. Please check API key and try again."
    }), { 
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
});
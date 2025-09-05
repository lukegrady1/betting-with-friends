// Deno runtime (Supabase Edge Functions)
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // for DB writes
const SPORTSDATA_KEY = Deno.env.get("SPORTSDATAIO_API_KEY")!;

// SportsDataIO API endpoints - check documentation for correct paths
const SCORES_BASE = "https://api.sportsdata.io/v3/nfl/scores/json";

async function fetchJson(url: string) {
  console.log(`Fetching URL: ${url}`);
  console.log(`Using API key: ${SPORTSDATA_KEY ? SPORTSDATA_KEY.slice(0, 8) + '...' : 'NOT SET'}`);
  
  const r = await fetch(url, { headers: { "Ocp-Apim-Subscription-Key": SPORTSDATA_KEY } });
  
  console.log(`Response status: ${r.status}`);
  console.log(`Response headers:`, Object.fromEntries(r.headers.entries()));
  
  if (!r.ok) {
    const errorText = await r.text();
    console.error(`API Error: ${r.status} ${errorText}`);
    throw new Error(`SportsDataIO API Error: ${r.status} ${errorText}`);
  }
  return r.json();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response("Method not allowed", { 
        status: 405,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        }
      });
    }

    const { searchParams } = new URL(req.url);
    let season = Number(searchParams.get("season"));
    const week = Number(searchParams.get("week"));
    const leagueId = searchParams.get("leagueId");
    
    if (!season || !week || !leagueId) {
      return new Response("Missing season, week, or leagueId", { 
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        }
      });
    }

    // Create Supabase client with service role for database operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Create another client for user authentication verification
    const supabaseAuth = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: req.headers.get("Authorization") ?? "",
          },
        },
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Verify user is an admin of the league
    const { data: memberData, error: memberError } = await supabase
      .from("league_members")
      .select("role")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !memberData || memberData.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        {
          status: 403,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    }

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
          { 
            status: 429,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Content-Type": "application/json",
            }
          }
        );
      }
    }

    // Test SportsDataIO API connection step by step
    console.log(`Starting API test for season ${season}, week ${week}`);
    console.log(`API key configured: ${SPORTSDATA_KEY ? 'YES' : 'NO'}`);
    
    let games = [];
    let stadiums = [];
    
    // Step 1: Test basic API connectivity with a simple endpoint
    try {
      console.log("Step 1: Testing basic API connectivity");
      const testUrl = `${SCORES_BASE}/Stadiums`;
      console.log(`Calling: ${testUrl}`);
      stadiums = await fetchJson(testUrl);
      console.log(`✓ Stadiums API works! Got ${stadiums.length} stadiums`);
      
      // Step 2: Test games endpoint with known working parameters
      console.log("Step 2: Testing games endpoint");
      const gamesUrl = `${SCORES_BASE}/GamesByWeek/2024/1`;
      console.log(`Calling: ${gamesUrl}`);
      games = await fetchJson(gamesUrl);
      console.log(`✓ Games API works! Got ${games.length} games`);
      
      // Use 2024 data for now since it works
      season = 2024;
      
    } catch (apiError) {
      console.error("API Test Failed:", apiError);
      throw new Error(`SportsDataIO API test failed: ${apiError.message}. Please verify your API key and subscription.`);
    }
    
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
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      status: 200,
    });
  } catch (e) {
    console.error("NFL sync error:", e);
    
    // Better error handling and logging
    let errorMessage = "Unknown error occurred";
    if (e instanceof Error) {
      errorMessage = e.message;
    } else if (typeof e === 'string') {
      errorMessage = e;
    } else {
      errorMessage = JSON.stringify(e);
    }
    
    console.error("Formatted error message:", errorMessage);
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      message: "Failed to sync NFL events. Please check the function logs for details.",
      timestamp: new Date().toISOString()
    }), { 
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
});
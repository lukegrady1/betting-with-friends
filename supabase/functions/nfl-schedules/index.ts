// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SPORTSDATA_KEY = Deno.env.get("SPORTSDATAIO_API_KEY")!;

const BASE = "https://api.sportsdata.io/v3/nfl/scores/json";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function ok(json: unknown, status = 200) {
  return new Response(JSON.stringify(json), { 
    status, 
    headers: { 
      "content-type": "application/json",
      ...corsHeaders
    } 
  });
}
function bad(msg: string, status = 400) { return ok({ error: msg }, status); }

async function fetchJson(url: string) {
  const r = await fetch(url, { headers: { "Ocp-Apim-Subscription-Key": SPORTSDATA_KEY } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

function normalizeRow(g: any, league_id?: string) {
  // Choose UTC time if provided; fall back to Date/DateTime
  const start_iso = g.DateTimeUTC ?? g.DateTime ?? g.Date;
  const s = g.StadiumDetails || {};
  return {
    league_id: league_id ?? null,            // per‑league duplication for RLS simplicity
    sport: "NFL",
    league_name: "NFL",
    season: Number(g.Season),
    week: Number(g.Week),
    home_team: g.HomeTeam,
    away_team: g.AwayTeam,
    start_time: start_iso,                   // timestamptz in DB
    status: g.Status ?? "scheduled",
    venue_name: s.Name ?? null,
    venue_city: s.City ?? null,
    venue_state: s.State ?? null,
    external_provider: "sportsdataio",
    external_id: String(g.GameKey ?? g.GlobalGameID ?? g.ScoreID),
    created_by: null,
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url);
    const season = Number(url.searchParams.get("season") ?? "2025");
    const league_id = url.searchParams.get("league_id") ?? undefined; // optional: duplicate per league
    const mode = (url.searchParams.get("mode") ?? "upsert").toLowerCase(); // "preview" | "upsert"

    if (!season) return bad("Missing 'season' (e.g., 2025)");

    const endpoint = `${BASE}/Schedules/${season}`; // per user request
    const raw = await fetchJson(endpoint);

    const rows = (raw as any[]).map((g) => normalizeRow(g, league_id));

    if (mode === "preview") {
      return ok({ season, count: rows.length, events: rows });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Upsert by provider+external_id+league_id (using the unique constraint we created)
    const { data, error } = await supabase
      .from("events")
      .upsert(rows, { onConflict: "external_provider,external_id,league_id" })
      .select();

    if (error) throw error;

    return ok({ season, count: data?.length ?? 0, events: data });
  } catch (e) {
    return ok({ error: String(e) }, 500);
  }
});
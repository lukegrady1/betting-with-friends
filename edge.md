# Edge Function — NFL Schedules via SportsDataIO (Shows on Events Page)

> **Goal:** Create a Supabase **Edge Function** that fetches NFL schedules from SportsDataIO’s **Schedules/{season}** endpoint, **normalizes & upserts** into the `public.events` table, and returns the rows so the **Events** page can render selectable games (leading to **New Pick**).

Your example endpoint (do **NOT** hardcode the key; use env secrets):

```
https://api.sportsdata.io/v3/nfl/scores/json/Schedules/2025?key=YOUR_KEY
```

Prefer passing the key via header `Ocp-Apim-Subscription-Key` inside the Edge Function so the browser never sees it.

---

## 0) Prereqs

* Supabase project created.
* `events` table has these extra columns (see `events.md`): `season int, week int, venue_name text, venue_city text, venue_state text, external_provider text, external_id text` (nullable OK).
* `created_by` should be **nullable** for system upserts (or set to a sentinel UUID if you want it NOT NULL).

```sql
alter table public.events
  alter column created_by drop not null;

create index if not exists events_provider_idx on public.events(external_provider, external_id);
create index if not exists events_season_week_idx on public.events(season, week);
```

RLS: keep existing membership rules; we will upsert with **service role key** inside the function.

---

## 1) Secrets / Env

In **Supabase Dashboard → Edge Functions → Secrets** set:

```
SPORTSDATAIO_API_KEY = <your SportsDataIO key>
SUPABASE_URL = https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY = <service role key>
```

> Never expose the SportsDataIO key in client code.

If the frontend needs to call the function:

```
VITE_PUBLIC_FUNCTIONS_URL = https://<your-project-ref>.functions.supabase.co
```

---

## 2) Edge Function: `nfl-schedules` (Deno / TypeScript)

**File:** `supabase/functions/nfl-schedules/index.ts`

```ts
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SPORTSDATA_KEY = Deno.env.get("SPORTSDATAIO_API_KEY")!;

const BASE = "https://api.sportsdata.io/v3/nfl/scores/json";

function ok(json: unknown, status = 200) {
  return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
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

    // Upsert by provider+external_id+(league_id if provided)
    const onConflict = league_id ? "league_id,external_provider,external_id" : "external_provider,external_id";

    const { data, error } = await supabase
      .from("events")
      .upsert(rows, { onConflict })
      .select();

    if (error) throw error;

    return ok({ season, count: data?.length ?? 0, events: data });
  } catch (e) {
    return ok({ error: String(e) }, 500);
  }
});
```

**Deploy:**

```bash
supabase functions deploy nfl-schedules
supabase secrets set SPORTSDATAIO_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_URL=...
```

---

## 3) Frontend usage

### 3.1 Simple sync button (admin only)

```ts
// src/lib/functions.ts
export async function syncSeason({ season, leagueId }: { season: number; leagueId?: string }) {
  const base = import.meta.env.VITE_PUBLIC_FUNCTIONS_URL;
  const u = new URL(`${base}/nfl-schedules`);
  u.searchParams.set("season", String(season));
  if (leagueId) u.searchParams.set("league_id", leagueId);
  u.searchParams.set("mode", "upsert");
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
```

### 3.2 List events from DB on **EventsPage**

```tsx
// src/routes/leagues/EventsPage.tsx (excerpt)
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, MapPin, ArrowRight } from "lucide-react";
import { syncSeason } from "@/lib/functions";

function formatKickoff(iso: string) { return new Date(iso).toLocaleString(); }

export default function EventsPage() {
  const leagueId = useLeagueId(); // from route
  const season = 2025; // or dynamic from a selector
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["events", leagueId, season],
    queryFn: async () => {
      let q = supabase.from("events")
        .select("id, home_team, away_team, start_time, venue_name, venue_city, venue_state, status")
        .eq("season", season)
        .order("start_time", { ascending: true });
      if (leagueId) q = q.eq("league_id", leagueId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { mutate: doSync, isPending } = useMutation({
    mutationFn: () => syncSeason({ season, leagueId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events", leagueId, season] }),
  });

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">NFL Schedule · {season}</h1>
        <Button variant="secondary" size="sm" onClick={() => doSync()} disabled={isPending} className="rounded-xl">
          {isPending ? "Syncing…" : "Sync Season"}
        </Button>
      </header>

      {isLoading ? <SkeletonList /> : (
        <div className="grid grid-cols-1 gap-3">
          {data.map((e) => (
            <Card key={e.id} className="soft p-4" data-testid="event-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">{e.away_team} @ {e.home_team}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4"/>{formatKickoff(e.start_time)}</span>
                    {e.venue_name && (
                      <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4"/>{e.venue_name}{e.venue_city ? ` · ${e.venue_city}, ${e.venue_state ?? ""}` : ""}</span>
                    )}
                  </div>
                </div>
                <Button className="rounded-xl" onClick={() => navigate(`/leagues/${leagueId}/picks/new?event=${e.id}`)}>
                  Select <ArrowRight className="ml-2 h-4 w-4"/>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

> The **Select** button routes users to your **NewPick** page with the `event` query param; `PickForm` will prefill and validate against `start_time` as already outlined.

---

## 4) Field Mapping (from your sample JSON)

Input (SportsDataIO):

```json
{
  "GameKey": "202510126",
  "SeasonType": 1,
  "Season": 2025,
  "Week": 1,
  "Date": "2025-09-04T20:20:00",
  "AwayTeam": "DAL",
  "HomeTeam": "PHI",
  "Channel": "NBC",
  "PointSpread": -2.1,
  "OverUnder": 12.6,
  "StadiumID": 18,
  "Status": "Final",
  "DateTimeUTC": "2025-09-05T00:20:00",
  "StadiumDetails": { "Name": "Lincoln Financial Field", "City": "Philadelphia", "State": "PA" }
}
```

Normalized → `public.events`:

```
external_provider = 'sportsdataio'
external_id      = GameKey (or GlobalGameID/ScoreID fallback)
season           = Season
week             = Week
home_team        = HomeTeam
away_team        = AwayTeam
start_time       = DateTimeUTC || DateTime || Date (ISO)
status           = Status || 'scheduled'
venue_name       = StadiumDetails.Name
venue_city       = StadiumDetails.City
venue_state      = StadiumDetails.State
league_id        = <optional, if duplicating per league>
```

We intentionally do **not** store betting lines here—those belong to picks/odds layers.

---

## 5) Optional: Preview Mode

Call the function with `mode=preview` to **not write**, just to inspect payload shape:

```
GET {functions}/nfl-schedules?season=2025&mode=preview
```

---

## 6) Playwright MCP test (sanity)

**tests/nfl-schedules.spec.ts**

```ts
import { test, expect } from "@playwright/test";

// assumes dev server + react-query + seeded auth

test("events list renders and select navigates", async ({ page }) => {
  await page.goto("http://localhost:5173/leagues/LEAGUE_ID/events");
  await page.getByRole("button", { name: /Sync Season/i }).click();
  const firstCard = page.getByTestId("event-card").first();
  await expect(firstCard).toBeVisible();
  await firstCard.getByRole("button", { name: /Select/i }).click();
  await expect(page).toHaveURL(/picks\/new\?event=/);
});
```

---

## 7) Acceptance Criteria

* [ ] Edge function pulls from **Schedules/{season}**, normalizes, and **upserts** into `public.events`.
* [ ] Events page reads from DB and shows **opponent, kickoff time, and venue**.
* [ ] Clicking **Select** routes to **NewPick** with the event prefilled.
* [ ] Key is never exposed in the browser; only the Edge Function has it.
* [ ] Playwright test passes.

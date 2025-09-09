# Events Integration — SportsDataIO (Free Tier) → NFL Schedules + Pick Flow

> **Objective:** Use **SportsDataIO** (NFL Scores API, free perpetual trial tier) to fetch official NFL schedules (home/away, kickoff time, venue) and surface them on the **Events** page. Users select a game → taken to **NewPickPage** pre‑filled with that event to submit a pick. All data ultimately lives in Supabase (`events` + `picks`) so RLS/visibility rules keep working.

---

## 1) Provider & Endpoints (NFL Scores API)

* Base: `https://api.sportsdata.io/v3/nfl/scores/json`
* Key header: `Ocp-Apim-Subscription-Key: <API_KEY>` (you may also pass `?key=<API_KEY>` as a query param if needed)
* Useful endpoints:

  * **Games by Week**: `/GamesByWeek/{season}/{week}` → canonical for week filtering
  * **Schedules for Season**: `/Schedules/{season}` → full year
  * **Stadiums**: `/Stadiums` → venue metadata (map `StadiumID` → name/city/state)

**Notes**

* `season` is four‑digit season year, e.g., `2025`
* `week` is integer (1..18; include pre/postseason as needed)
* Game fields of interest typically include: `GameKey`, `GameID`, `Date` (ISO string), `HomeTeam`, `AwayTeam`, `StadiumID`, and sometimes an embedded `StadiumDetails` object depending on endpoint/version.

---

## 2) Env & Config

Add to **Supabase Edge Functions** env (Project → Functions → Secrets):

* `SPORTSDATAIO_API_KEY = <your key>`

Client side (Vite):

* `VITE_PUBLIC_FUNCTIONS_URL = <https://<your-project-ref>.functions.supabase.co>`

---

## 3) Supabase Schema Additions (venues)

> These extend the schema we already defined in `000_init.sql`.

```sql
alter table public.events
  add column if not exists week int,
  add column if not exists season int,
  add column if not exists venue_name text,
  add column if not exists venue_city text,
  add column if not exists venue_state text,
  add column if not exists external_provider text,
  add column if not exists external_id text;

create index if not exists events_season_week_idx on public.events(season, week);
create index if not exists events_start_idx on public.events(start_time);
```

> Keep RLS policies as previously defined. Reads/writes remain membership‑scoped.

---

## 4) Edge Function: `nfl-sync-week`

**Purpose:** Fetch NFL games for a given `{season, week}` from SportsDataIO, enrich with stadiums if needed, and **upsert** rows into `public.events`. Returns normalized rows.

**File:** `supabase/functions/nfl-sync-week/index.ts`

```ts
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
    const { searchParams } = new URL(req.url);
    const season = Number(searchParams.get("season"));
    const week = Number(searchParams.get("week"));
    if (!season || !week) return new Response("Missing season or week", { status: 400 });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [games, stadiums] = await Promise.all([
      fetchJson(`${SCORES_BASE}/GamesByWeek/${season}/${week}`),
      fetchJson(`${SCORES_BASE}/Stadiums`),
    ]);
    const stadiumById = new Map<number, any>(stadiums.map((s: any) => [s.StadiumID, s]));

    const rows = games.map((g: any) => {
      const s = stadiumById.get(g.StadiumID) || g.StadiumDetails || {};
      return {
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
        created_by: null,              // system insert; keep NOT NULL off for this field
      };
    });

    // Upsert into events by (external_provider, external_id)
    const { data, error } = await supabase
      .from("events")
      .upsert(rows, { onConflict: "external_provider,external_id" })
      .select();

    if (error) throw error;

    return new Response(JSON.stringify({ count: data?.length ?? 0, events: data }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
```

**Edge Function config notes**

* Ensure `created_by` in `events` is nullable (system inserts). If not, relax it or set a sentinel UUID.
* Add an **invoke key** for client calls or proxy the function via your server where appropriate.

---

## 5) Client → Sync on Demand (admin‑only button)

Add an admin action on Events page: **“Sync Week”** → calls edge function then refreshes list.

```ts
// src/lib/functions.ts
export async function syncWeek({ season, week }: { season: number; week: number }) {
  const base = import.meta.env.VITE_PUBLIC_FUNCTIONS_URL;
  const r = await fetch(`${base}/nfl-sync-week?season=${season}&week=${week}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
```

Gate the button by role (`league_members.role = 'admin'`).

---

## 6) Events Page UI (list → select → pick)

### 6.1 Query events (from DB, not provider)

```tsx
// src/routes/leagues/EventsPage.tsx
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, MapPin, ArrowRight } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

export default function EventsPage() {
  const navigate = useNavigate();
  const { leagueId } = useParams();
  const [season, week] = useSeasonWeek(); // implement: defaults to current

  const { data, isLoading } = useQuery({
    queryKey: ["events", leagueId, season, week],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, home_team, away_team, start_time, venue_name, venue_city, venue_state, status")
        .eq("league_id", leagueId)
        .eq("season", season)
        .eq("week", week)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Week {week} · {season}</h1>
        {/* Admin-only sync button */}
        <SyncWeekButton season={season} week={week} />
      </header>

      {isLoading ? <SkeletonList /> : (
        <div className="grid grid-cols-1 gap-3">
          {data.map((e) => (
            <Card key={e.id} className="soft p-4">
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

### 6.2 New Pick flow (prefill)

`/picks/new?event=<id>`: read `event` from query, fetch the event, and prefill the **PickForm**. Disable submission if `now >= start_time`.

```tsx
// src/routes/leagues/NewPickPage.tsx (excerpt)
const eventId = new URLSearchParams(location.search).get("event");
const { data: event } = useQuery({
  queryKey: ["event", eventId],
  queryFn: async () => (await supabase.from("events").select("*").eq("id", eventId).single()).then(r => r.data)
});

<PickForm event={event} onSubmitted={() => navigate(`/leagues/${leagueId}/picks`)} />
```

---

## 7) Linking Events → League (data model)

When syncing, set `league_id` on `events` to the current league if you want **per‑league** event copies (simplest for RLS). Two options:

1. **Per‑league duplication**: Insert events with `league_id` for each league (safe with RLS; more rows).
2. **Global events**: Store once without `league_id` and reference via a join table `league_events(league_id, event_id)`. Requires slight RLS tweaks.

Use **option 1** for MVP (clear membership scoping). The sync action on a league should insert/upsert events for that league.

---

## 8) Admin Sync Button

```tsx
function SyncWeekButton({ season, week }: { season: number; week: number }) {
  const { leagueId } = useParams();
  const q = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationFn: () => syncWeek({ season, week }),
    onSuccess: () => q.invalidateQueries({ queryKey: ["events", leagueId, season, week] }),
  });
  return (
    <Button size="sm" variant="secondary" onClick={() => mutate()} disabled={isPending} className="rounded-xl">
      {isPending ? "Syncing…" : "Sync Week"}
    </Button>
  );
}
```

---

## 9) Playwright MCP Tests (happy path)

Create `tests/events.spec.ts`.

```ts
import { test, expect } from "@playwright/test";

// Assumes local dev with a seeded league and the sync function working.

test.describe("Events → New Pick flow", () => {
  test("lists games for a week and navigates to new pick", async ({ page }) => {
    await page.goto("http://localhost:5173/leagues/LEAGUE_ID/events?season=2025&week=1");
    await expect(page.getByRole("heading", { name: /Week 1/i })).toBeVisible();

    const firstCard = page.locator('[data-testid="event-card"]').first();
    await expect(firstCard).toBeVisible();
    await firstCard.getByRole("button", { name: /Select/i }).click();

    await expect(page).toHaveURL(/\/picks\/new\?event=/);
    await expect(page.getByText(/Moneyline|Spread|Total/i)).toBeVisible();
  });
});
```

> Use `data-testid="event-card"` on the card wrapper if you prefer test‑stable selectors.

---

## 10) Error Handling & Rate Limit

* If SportsDataIO returns 429/403, show a toast: *“Rate limit reached. Try again later.”*
* Cache the latest sync timestamp per `{season, week, league}` in a small table `sync_log` or just rely on upsert idempotency.

```sql
create table if not exists public.sync_log (
  league_id uuid not null,
  season int not null,
  week int not null,
  last_synced_at timestamptz default now(),
  primary key (league_id, season, week)
);
```

---

## 11) Acceptance Criteria

* [ ] Admin can press **Sync Week** and see NFL games populate with **teams, kickoff time (localized), and venue**.
* [ ] Events page lists games in chronological order with clean cards.
* [ ] Clicking **Select** opens **NewPickPage** with event prefilled.
* [ ] Submitting a pick before start inserts into `picks` (RLS enforced); after start, UI disables submission.
* [ ] Playwright test passes on CI.

---

## 12) Implementation Notes for Claude Code

* Keep all fetches to SportsDataIO **server‑side** in the edge function (never expose the API key in the browser).
* Normalize team codes (e.g., `NE` → `Patriots`) only for display; store raw codes in DB.
* Store `start_time` as UTC; format to user local time in UI.
* Use TanStack Query for Events + Picks pages; keep skeletons/spinner from `uiupdate.md`.
* Respect existing RLS; events remain readable only to league members if duplicated per league.

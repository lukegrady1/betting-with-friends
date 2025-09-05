# Betting With Friends — Build Spec for Claude Code (Vite + React + Supabase)

> **Goal:** Ship a mobile‑first web app where friends submit sports betting picks privately (hidden from others until each game starts), then automatically compute win/loss, units, and profit/loss per user. Use **Vite + React + TypeScript** on the frontend and **Supabase (Postgres + Auth + RLS)** on the backend.

---

## 0) High‑Level Requirements

1. **Private picks until kickoff**
   • Users can submit picks for scheduled events.
   • Picks remain visible **only to the user** until the event’s `start_time`.
   • After `start_time`, all members of that league can see everyone’s picks.

2. **Leagues & leaderboards**
   • Users can create a league, join via invite code, and see leaderboards.
   • Leaderboard shows: Wins, Losses, Pushes, Win%, Units Risked, Profit/Loss (in units), and Net Units.

3. **Picks model (MVP markets)**
   • Markets supported in v1: **Moneyline, Spread, Total**.
   • Odds format: **American** (e.g., -110, +145).
   • Stake is in **units** (decimal allowed, e.g., 0.5u).
   • Parlay/props can be added later.

4. **Events & grading**
   • Each pick references an **Event** with `home_team`, `away_team`, and `start_time`.
   • League Admins can add Events and later input final scores (MVP), which auto‑grades picks.
   • (Optional later) Hook to 3rd‑party sports APIs to auto‑ingest schedules & results.

5. **Mobile‑first**
   • Optimized for small screens: bottom nav, large touch targets, single‑column layout.
   • Keep desktop responsive but mobile is primary.

6. **Security & integrity**
   • Enforce “hidden until start” **at the database level** (RLS + views), not just the UI.
   • Users can only read/write within leagues they belong to.
   • After `start_time`, picks become readable to league members.

---

## 1) Tech Stack

* **Frontend:** Vite + React + TypeScript
* **Styling:** Tailwind CSS + shadcn/ui + lucide-react icons
* **Data:** Supabase JS Client (Auth + Postgres), TanStack Query (react‑query)
* **State:** URL params + server state via Query; minimal local store (Zustand optional)
* **Deployment:** Vercel (frontend) + Supabase (managed Postgres/Auth/Edge Functions)

---

## 2) Project Structure (monorepo not required)

```
root/
  .env.example
  README.md
  supabase/
    migrations/
      000_init.sql
      010_rls.sql
      020_functions_and_views.sql
  web/
    index.html
    vite.config.ts
    tsconfig.json
    src/
      main.tsx
      App.tsx
      lib/
        supabase.ts
        odds.ts
        time.ts
        types.ts
      routes/
        auth/
          SignInPage.tsx
          Callback.tsx
        leagues/
          LeaguesPage.tsx
          CreateLeaguePage.tsx
          JoinLeaguePage.tsx
          LeagueHomePage.tsx
          LeaderboardPage.tsx
          EventsPage.tsx
          NewEventPage.tsx
          PicksPage.tsx
          NewPickPage.tsx
          SettingsPage.tsx (admin)
      components/
        Layout/
          MobileShell.tsx
          TopBar.tsx
          BottomNav.tsx
        UI/
          Button.tsx (re-export from shadcn if needed)
          Card.tsx (shadcn)
          StatBadge.tsx
          EmptyState.tsx
          Countdown.tsx
        picks/
          PickForm.tsx
          PickRow.tsx
          PickList.tsx
        events/
          EventCard.tsx
          EventList.tsx
        leaderboard/
          LeaderboardTable.tsx
      styles/
        globals.css
```

---

## 3) Environment Variables

`web/.env` (use `.env.local` for secrets during dev):

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Supabase Dashboard → Project Settings → API to obtain URL and anon key.

---

## 4) Supabase: Schema & Security

### 4.1 Tables

```sql
-- profiles: minimal user profile (Supabase will maintain auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  created_at timestamptz default now()
);

-- leagues
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- league_members
create table if not exists public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member', -- 'admin' | 'member'
  joined_at timestamptz default now(),
  primary key (league_id, user_id)
);

-- events (games)
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  sport text not null,            -- e.g., NFL, NBA, MLB
  league_name text,               -- e.g., AFC East; optional
  home_team text not null,
  away_team text not null,
  start_time timestamptz not null,
  status text not null default 'scheduled', -- 'scheduled' | 'final' | 'canceled'
  home_score int,
  away_score int,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- picks
create table if not exists public.picks (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  market text not null,           -- 'moneyline' | 'spread' | 'total'
  side text not null,             -- moneyline: 'home' | 'away'; spread: 'home'|'away'; total: 'over'|'under'
  line numeric(8,2),              -- spread or total line; null for moneyline
  odds_american int not null,     -- e.g., -110, +145
  units_staked numeric(10,2) not null check (units_staked > 0),
  result text default 'pending',  -- 'pending' | 'win' | 'loss' | 'push' | 'void'
  profit_units numeric(12,4) default 0, -- computed when graded
  created_at timestamptz default now(),
  unique (user_id, event_id, market, side, line)  -- prevent duplicate identical pick by same user
);

-- convenience updated_at trigger
create extension if not exists moddatetime;
select extname from pg_extension; -- ensure installed
alter table public.events add column if not exists updated_at timestamptz;
create trigger set_timestamp before update on public.events for each row execute procedure moddatetime (updated_at);

alter table public.picks add column if not exists updated_at timestamptz;
create trigger set_timestamp_picks before update on public.picks for each row execute procedure moddatetime (updated_at);
```

### 4.2 Core “Hidden Until Start” Logic

We expose a **view** that masks pick details until the event `start_time`. Members always see their own picks. Others only see details after kickoff; before that, they see row metadata but with redacted fields.

```sql
create or replace view public.picks_visible as
select
  p.id,
  p.league_id,
  p.event_id,
  p.user_id,
  -- Redact core fields until reveal
  case
    when p.user_id = auth.uid() then p.market
    when now() >= e.start_time then p.market
    else 'hidden'::text
  end as market,
  case
    when p.user_id = auth.uid() then p.side
    when now() >= e.start_time then p.side
    else null
  end as side,
  case
    when p.user_id = auth.uid() then p.line
    when now() >= e.start_time then p.line
    else null
  end as line,
  case
    when p.user_id = auth.uid() then p.odds_american
    when now() >= e.start_time then p.odds_american
    else null
  end as odds_american,
  case
    when p.user_id = auth.uid() then p.units_staked
    when now() >= e.start_time then p.units_staked
    else null
  end as units_staked,
  p.result,
  p.profit_units,
  p.created_at
from public.picks p
join public.events e on e.id = p.event_id;
```

### 4.3 Row‑Level Security (RLS)

Enable RLS and add policies to enforce **league membership** and **hide until start** at the table level. We read from `picks_visible` view for display, but still lock down `picks` and `events` directly.

```sql
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.events enable row level security;
alter table public.picks enable row level security;

-- leagues: members can see the leagues they belong to; creator can manage
create policy "leagues_select_member" on public.leagues
  for select using ( exists(
    select 1 from public.league_members lm
    where lm.league_id = id and lm.user_id = auth.uid()
  ));

create policy "leagues_insert_creator" on public.leagues
  for insert with check (auth.uid() = created_by);

create policy "leagues_update_admin" on public.leagues
  for update using (exists(
    select 1 from public.league_members lm
    where lm.league_id = id and lm.user_id = auth.uid() and lm.role = 'admin'
  ));

-- league_members: users can see rows for leagues they belong to
create policy "lm_select_self_leagues" on public.league_members
  for select using (
    user_id = auth.uid() or exists(
      select 1 from public.league_members lm2
      where lm2.league_id = league_id and lm2.user_id = auth.uid()
    )
  );

create policy "lm_insert_self_join" on public.league_members
  for insert with check (user_id = auth.uid());

-- events: only members can view; only admins can create/update
create policy "events_select_members" on public.events
  for select using ( exists(
    select 1 from public.league_members lm
    where lm.league_id = league_id and lm.user_id = auth.uid()
  ));

create policy "events_insert_admin" on public.events
  for insert with check ( exists(
    select 1 from public.league_members lm
    where lm.league_id = league_id and lm.user_id = auth.uid() and lm.role = 'admin'
  ));

create policy "events_update_admin" on public.events
  for update using ( exists(
    select 1 from public.league_members lm
    where lm.league_id = league_id and lm.user_id = auth.uid() and lm.role = 'admin'
  ));

-- picks: members can read/write their own picks; others only see via the view
create policy "picks_select_owner_or_member_after_start" on public.picks
  for select using (
    user_id = auth.uid() OR exists (
      select 1 from public.events e
      join public.league_members lm on lm.league_id = e.league_id and lm.user_id = auth.uid()
      where e.id = event_id and now() >= e.start_time
    )
  );

create policy "picks_insert_member_before_start" on public.picks
  for insert with check (
    exists (
      select 1 from public.events e
      join public.league_members lm on lm.league_id = e.league_id and lm.user_id = auth.uid()
      where e.id = event_id and now() < e.start_time
    ) and user_id = auth.uid()
  );

create policy "picks_update_owner_before_start" on public.picks
  for update using (
    user_id = auth.uid() and exists (
      select 1 from public.events e where e.id = event_id and now() < e.start_time
    )
  );
```

### 4.4 Grading Functions & Triggers

Compute `result` and `profit_units` when an event is marked `final` and scores are present.

**American odds → units profit (win = +profit, loss = −stake, push = 0):**

```
if odds_american > 0: profit = units * (odds_american / 100.0)
else:               profit = units * (100.0 / abs(odds_american))
```

**PL/pgSQL helper:**

```sql
create or replace function public.units_profit_from_american(amt numeric, american int)
returns numeric language plpgsql as $$
declare p numeric;
begin
  if american > 0 then
    p := amt * (american::numeric / 100.0);
  else
    p := amt * (100.0 / abs(american)::numeric);
  end if;
  return p;
end; $$;
```

**Grader:**

```sql
create or replace function public.grade_picks_for_event(ev uuid) returns void
language plpgsql as $$
begin
  update public.picks p
  set result = case
        when e.status = 'final' and p.market = 'moneyline' then
          case when e.home_score is null or e.away_score is null then 'pending'
               when (e.home_score > e.away_score and p.side = 'home') or
                    (e.away_score > e.home_score and p.side = 'away') then 'win'
               when e.home_score = e.away_score then 'push' -- tie handling (rare, sport dependent)
               else 'loss' end
        when e.status = 'final' and p.market = 'spread' then
          case when e.home_score is null or e.away_score is null then 'pending'
               when p.side = 'home' then
                 case when (e.home_score + coalesce(-p.line,0)) > e.away_score then 'win'
                      when (e.home_score + coalesce(-p.line,0)) = e.away_score then 'push'
                      else 'loss' end
               else -- side = 'away'
                 case when (e.away_score + coalesce(-p.line,0)) > e.home_score then 'win'
                      when (e.away_score + coalesce(-p.line,0)) = e.home_score then 'push'
                      else 'loss' end
               end
        when e.status = 'final' and p.market = 'total' then
          case when e.home_score is null or e.away_score is null then 'pending'
               when p.side = 'over' then
                 case when (e.home_score + e.away_score) > p.line then 'win'
                      when (e.home_score + e.away_score) = p.line then 'push'
                      else 'loss' end
               else -- under
                 case when (e.home_score + e.away_score) < p.line then 'win'
                      when (e.home_score + e.away_score) = p.line then 'push'
                      else 'loss' end
               end
        else p.result
      end,
      profit_units = case
        when e.status = 'final' and p.result = 'win' then public.units_profit_from_american(p.units_staked, p.odds_american)
        when e.status = 'final' and p.result = 'loss' then -p.units_staked
        when e.status = 'final' and p.result = 'push' then 0
        else p.profit_units
      end
  from public.events e
  where p.event_id = e.id and e.id = ev;
end; $$;
```

**Trigger:** call grader after events are updated to `final`.

```sql
create or replace function public.on_events_after_update() returns trigger
language plpgsql as $$
begin
  if new.status = 'final' and (new.home_score is not null and new.away_score is not null) then
    perform public.grade_picks_for_event(new.id);
  end if;
  return new;
end; $$;

create trigger trg_events_after_update
  after update on public.events
  for each row execute function public.on_events_after_update();
```

### 4.5 Leaderboard View

Aggregate per user per league across **graded** picks.

```sql
create or replace view public.league_user_stats as
select
  p.league_id,
  p.user_id,
  count(*) filter (where p.result in ('win','loss','push')) as graded,
  count(*) filter (where p.result = 'win') as wins,
  count(*) filter (where p.result = 'loss') as losses,
  count(*) filter (where p.result = 'push') as pushes,
  round( (count(*) filter (where p.result = 'win'))::numeric /
         nullif(count(*) filter (where p.result in ('win','loss')) ,0) , 4) as win_pct,
  sum(p.units_staked) as units_risked,
  sum(p.profit_units) as net_units
from public.picks p
group by 1,2;
```

Add SELECT policies mirroring league membership:

```sql
grant select on public.picks_visible to anon, authenticated;
grant select on public.league_user_stats to anon, authenticated;
-- RLS on views piggybacks on underlying tables; ensure table policies allow membership‑scoped reads.
```

---

## 5) Frontend Implementation Details

### 5.1 UI/UX (Mobile‑first)

* **Navigation:** mobile bottom nav with 4 tabs in league context: *Home*, *Picks*, *Events*, *Board*.
* **Reveal state:**

  * Before start: other users’ picks show a **“Hidden until kickoff”** badge + countdown.
  * After start: rows expand to show side/line/odds/units.
* **Pick form:** select Event → market → side → line (if needed) → odds (american) → units. Validate all fields.
* **Empty states & skeletons:** show simple cards with CTA.
* **Admin tools:** event creation/edit, set final scores, mark `status='final'`.

### 5.2 Components & Hooks

* `lib/supabase.ts`: initialize client from `VITE_SUPABASE_*` envs.
* `lib/odds.ts`: convert American ↔ decimal, format odds.
* `lib/time.ts`: `formatStart`, `isStarted`, `countdown()` helper.
* `lib/types.ts`: shared TS types for rows and views.
* `PickForm.tsx`: controlled form; validation with zod; posts to `picks`.
* `PickList.tsx`: query `picks_visible` for league; group by `event_id`; show current user picks expanded, others hidden until start.
* `LeaderboardTable.tsx`: reads `league_user_stats` filtered by league.
* `EventList.tsx`/`EventCard.tsx`: list upcoming and past; “Final” badge if graded.
* `Countdown.tsx`: live countdown to `start_time` (minute precision to save battery).

### 5.3 Data Fetching Pattern

Use **TanStack Query** for server state; keys include leagueId. Example:

```ts
// fetch visible picks for a league
const { data } = useQuery({
  queryKey: ["picks-visible", leagueId],
  queryFn: async () => {
    return supabase.from("picks_visible")
      .select("* , events!inner(id,home_team,away_team,start_time,status)")
      .eq("league_id", leagueId)
      .order("created_at", { ascending: false })
      .then(r => r.data);
  }
});
```

### 5.4 Auth Flow

* Use **Supabase Auth** (email magic link or OAuth).
* On first sign‑in, insert a `profiles` row if missing.
* Protect routes with `onAuthStateChange` listener; redirect unauthenticated users to `SignInPage`.

### 5.5 League Create/Join

* Creating a league generates a random `invite_code` (8‑10 chars).
* Creator is inserted as `league_members` with role `admin`.
* Joining requires code → insert into `league_members` with role `member`.

### 5.6 Event Create/Finalize (Admin)

* Admin chooses teams, `start_time`.
* Events screen shows status chips: *Scheduled* → *Final*.
* When final scores are saved, the trigger runs to grade picks and update `league_user_stats` view.

### 5.7 Client‑side Guards (defense‑in‑depth)

* Disable pick submission UI when `now >= start_time`.
* Hide others’ picks until start; but rely on DB view + RLS as source of truth.

---

## 6) Styling

* Tailwind + shadcn/ui; rounded‑2xl cards, adequate spacing, readable type.
* **BottomNav** with icons (lucide): Home (`house`), Picks (`list`), Events (`calendar`), Board (`trophy`).
* Respect prefers‑reduced‑motion; keep animations minimal.

**Globals:**

```css
/* web/src/styles/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root { color-scheme: light dark; }
body { @apply bg-background text-foreground; }
.card { @apply rounded-2xl shadow-sm border p-4; }
.badge { @apply text-xs px-2 py-1 rounded-full border; }
```

---

## 7) Calculations & Rules

### 7.1 Odds & Profit

* **Win:** `profit_units = units_profit_from_american(units_staked, odds_american)`
* **Loss:** `profit_units = -units_staked`
* **Push:** `profit_units = 0`

### 7.2 Win Rate & Standings

* **Win%:** `wins / (wins + losses)` (exclude pushes).
* **Units Risked:** SUM of `units_staked` across all picks.
* **Net Units:** SUM of `profit_units`.

---

## 8) API/DB Access from Client

* Read lists from **views** (`picks_visible`, `league_user_stats`).
* Write to base tables (`picks`, `events`); RLS will enforce constraints.

**Insert pick** example:

```ts
await supabase.from('picks').insert({
  league_id,
  event_id,
  user_id: session.user.id,
  market, side, line, odds_american, units_staked
});
```

**Create event (admin)**:

```ts
await supabase.from('events').insert({
  league_id, sport, league_name, home_team, away_team, start_time, created_by: session.user.id
});
```

**Finalize event (admin)**:

```ts
await supabase.from('events').update({ status: 'final', home_score, away_score })
  .eq('id', event_id);
```

---

## 9) Testing Checklist

* [ ] Non‑members cannot read/write league data.
* [ ] Members can see **own** picks before start; cannot see others’ details until start.
* [ ] After `start_time`, all picks become visible to league members.
* [ ] Cannot insert/update picks if `now >= start_time`.
* [ ] Grading correctly sets `result` and `profit_units`.
* [ ] Leaderboard aggregates correctly for win%, units risked, and net units.
* [ ] Mobile nav & forms function on 360px wide screens.

---

## 10) Seed Script (Optional for Local)

Create a small SQL seed for a dummy league, two users, one event starting in 10 minutes, another already final. Ensure policies won’t block inserts while seeding (run as service role).

---

## 11) Deployment

1. **Supabase**: run migrations (`supabase/migrations/*.sql`) via SQL editor or `supabase CLI`.
2. **Frontend**: deploy `web/` on Vercel. Set env vars to Supabase URL/Anon key.
3. **Domains**: configure custom domain if desired.
4. **Production checks**: verify RLS, test hidden picks with two real accounts.

---

## 12) Future Enhancements

* Sports schedule & auto‑results via a data provider (The Odds API, Sportradar, etc.).
* More markets (player props, parlays), custom unit size per user.
* Notifications (email/push) for reveal or grading.
* League seasons, weekly winners, streaks.
* CSV export and audit logs.

---

## 13) Acceptance Criteria (MVP)

* Users can create/join leagues and authenticate.
* Admins can create events with start times; members can submit picks tied to those events.
* Picks are visible to owner immediately, **redacted** to others until start.
* Admins can finalize events with scores; picks auto‑grade; standings update.
* Leaderboard shows each member’s W‑L‑P, Win%, Units Risked, Net Units.
* App is smooth and usable on mobile (≤ 400px wide).

---

## 14) Notes for Claude Code

* Generate the **Supabase SQL** files exactly as above, split into migration steps:
  `000_init.sql` (tables), `010_rls.sql` (RLS/policies), `020_functions_and_views.sql` (views/functions/triggers).
* Scaffold the Vite React app with the file structure shown.
* Set up Tailwind + shadcn/ui and a minimal design system (cards, badges, buttons).
* Implement pages & components; wire data via Supabase client + TanStack Query.
* Write TypeScript types to mirror tables/views.
* Favor server‑driven rendering of visibility via the provided **views** and **policies** (do **not** fetch raw `picks` directly for listing).
* Add basic error & loading states; keep animations subtle; ensure keyboard navigation works.
* Provide a short README with setup steps and screenshots.

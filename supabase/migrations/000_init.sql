-- Initial schema for betting with friends app
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
alter table public.events add column if not exists updated_at timestamptz;
create trigger set_timestamp before update on public.events for each row execute procedure moddatetime (updated_at);

alter table public.picks add column if not exists updated_at timestamptz;
create trigger set_timestamp_picks before update on public.picks for each row execute procedure moddatetime (updated_at);
-- Events NFL Integration Schema Updates
-- Adds venue, season, week, and external provider fields for NFL integration

alter table public.events
  add column if not exists week int,
  add column if not exists season int,
  add column if not exists venue_name text,
  add column if not exists venue_city text,
  add column if not exists venue_state text,
  add column if not exists external_provider text,
  add column if not exists external_id text;

-- Allow created_by to be nullable for system-inserted events
alter table public.events alter column created_by drop not null;

-- Add indexes for performance
create index if not exists events_season_week_idx on public.events(season, week);
create index if not exists events_start_idx on public.events(start_time);
create index if not exists events_external_idx on public.events(external_provider, external_id);

-- Create sync log table for tracking rate limits and preventing duplicate syncs
create table if not exists public.sync_log (
  league_id uuid not null references public.leagues(id) on delete cascade,
  season int not null,
  week int not null,
  last_synced_at timestamptz default now(),
  primary key (league_id, season, week)
);

-- RLS for sync_log - only league admins can read/write
alter table public.sync_log enable row level security;

create policy "sync_log_select_admin" on public.sync_log
  for select using (exists(
    select 1 from public.league_members lm
    where lm.league_id = sync_log.league_id 
    and lm.user_id = auth.uid() 
    and lm.role = 'admin'
  ));

create policy "sync_log_insert_admin" on public.sync_log
  for insert with check (exists(
    select 1 from public.league_members lm
    where lm.league_id = sync_log.league_id 
    and lm.user_id = auth.uid() 
    and lm.role = 'admin'
  ));

create policy "sync_log_update_admin" on public.sync_log
  for update using (exists(
    select 1 from public.league_members lm
    where lm.league_id = sync_log.league_id 
    and lm.user_id = auth.uid() 
    and lm.role = 'admin'
  ));
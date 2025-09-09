-- Add additional columns for NFL schedule data
alter table public.events add column if not exists season int;
alter table public.events add column if not exists week int;
alter table public.events add column if not exists venue_name text;
alter table public.events add column if not exists venue_city text;
alter table public.events add column if not exists venue_state text;
alter table public.events add column if not exists external_provider text;
alter table public.events add column if not exists external_id text;

-- Make created_by nullable for system upserts
alter table public.events alter column created_by drop not null;

-- Add indexes for efficient querying
create index if not exists events_provider_idx on public.events(external_provider, external_id);
create index if not exists events_season_week_idx on public.events(season, week);

-- Add unique constraint for external events to prevent duplicates
alter table public.events add constraint if not exists events_external_unique 
  unique(external_provider, external_id, league_id);
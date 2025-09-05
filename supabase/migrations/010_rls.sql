-- Row Level Security policies and views for betting app

-- Core "Hidden Until Start" Logic
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

-- Enable RLS on all tables
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.events enable row level security;
alter table public.picks enable row level security;

-- leagues: allow insert for authenticated users, select for members
create policy "leagues_insert_creator" on public.leagues
  for insert with check (auth.uid() = created_by);

create policy "leagues_select_member" on public.leagues
  for select using ( 
    created_by = auth.uid() OR 
    exists(
      select 1 from public.league_members lm
      where lm.league_id = id and lm.user_id = auth.uid()
    )
  );

create policy "leagues_update_admin" on public.leagues
  for update using (
    created_by = auth.uid() OR
    exists(
      select 1 from public.league_members lm
      where lm.league_id = id and lm.user_id = auth.uid() and lm.role = 'admin'
    )
  );

-- league_members: users can see rows for leagues they belong to
create policy "lm_select_self_or_member" on public.league_members
  for select using (user_id = auth.uid());

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

-- Grant permissions on views
grant select on public.picks_visible to anon, authenticated;
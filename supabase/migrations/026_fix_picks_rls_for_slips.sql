-- Fix RLS policies for picks to allow slip-based picks (with event_id = null)

-- Drop the existing restrictive insert policy
drop policy if exists "picks_insert_member_before_start" on public.picks;

-- Create new insert policy that allows both event-based and slip-based picks
create policy "picks_insert_member_or_slip" on public.picks
for insert with check (
  user_id = auth.uid() and
  (
    -- Case 1: Event-based pick (existing logic)
    (
      event_id is not null and
      exists (
        select 1 from public.events e
        join public.league_members lm on lm.league_id = e.league_id and lm.user_id = auth.uid()
        where e.id = event_id and now() < e.start_time
      )
    )
    OR
    -- Case 2: Slip-based pick (no event_id, just check league membership)
    (
      event_id is null and
      exists (
        select 1 from public.league_members lm
        where lm.league_id = league_id and lm.user_id = auth.uid()
      )
    )
  )
);

-- Also need to update the select policy to handle null event_id
drop policy if exists "picks_select_owner_or_member_after_start" on public.picks;

create policy "picks_select_owner_or_member" on public.picks
for select using (
  user_id = auth.uid() OR 
  (
    -- For event-based picks, use existing logic
    event_id is not null and exists (
      select 1 from public.events e
      join public.league_members lm on lm.league_id = e.league_id and lm.user_id = auth.uid()
      where e.id = event_id and now() >= e.start_time
    )
  ) OR
  (
    -- For slip-based picks, only league members can see after creation
    event_id is null and exists (
      select 1 from public.league_members lm
      where lm.league_id = league_id and lm.user_id = auth.uid()
    )
  )
);

-- Update the picks_visible view to handle null event_id gracefully
drop view if exists public.picks_visible;

create or replace view public.picks_visible as
select
  p.id,
  p.league_id,
  p.event_id,
  p.user_id,
  -- For slip-based picks (event_id is null), always show to owner and league members
  -- For event-based picks, use the original hiding logic
  case
    when p.user_id = auth.uid() then p.market
    when p.event_id is null then p.market  -- slip-based picks are always visible to league members
    when now() >= e.start_time then p.market
    else 'hidden'::text
  end as market,
  case
    when p.user_id = auth.uid() then p.side
    when p.event_id is null then p.side
    when now() >= e.start_time then p.side
    else null
  end as side,
  case
    when p.user_id = auth.uid() then p.line
    when p.event_id is null then p.line
    when now() >= e.start_time then p.line
    else null
  end as line,
  case
    when p.user_id = auth.uid() then p.odds_american
    when p.event_id is null then p.odds_american
    when now() >= e.start_time then p.odds_american
    else null
  end as odds_american,
  case
    when p.user_id = auth.uid() then p.units_staked
    when p.event_id is null then p.units_staked
    when now() >= e.start_time then p.units_staked
    else null
  end as units_staked,
  p.result,
  p.profit_units,
  p.created_at
from public.picks p
left join public.events e on e.id = p.event_id;  -- LEFT JOIN to handle null event_id

-- Grant permissions
grant select on public.picks_visible to anon, authenticated;
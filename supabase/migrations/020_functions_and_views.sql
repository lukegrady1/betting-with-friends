-- Grading functions, triggers, and leaderboard views

-- American odds to units profit helper function
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

-- Grade picks for a specific event
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

-- Trigger function for auto-grading after event updates
create or replace function public.on_events_after_update() returns trigger
language plpgsql as $$
begin
  if new.status = 'final' and (new.home_score is not null and new.away_score is not null) then
    perform public.grade_picks_for_event(new.id);
  end if;
  return new;
end; $$;

-- Trigger to auto-grade picks when events are finalized
create trigger trg_events_after_update
  after update on public.events
  for each row execute function public.on_events_after_update();

-- Leaderboard view: aggregate stats per user per league
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

-- Grant permissions on leaderboard view
grant select on public.league_user_stats to anon, authenticated;
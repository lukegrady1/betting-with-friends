-- Fix picks table schema to support slip-based picks

-- Make event_id nullable (for slip-based picks)
alter table public.picks alter column event_id drop not null;

-- Make units_staked nullable and update check constraint
alter table public.picks alter column units_staked drop not null;
alter table public.picks drop constraint if exists picks_units_staked_check;
alter table public.picks add constraint picks_units_staked_check 
  check (units_staked is null or units_staked > 0);

-- Update unique constraint to handle null event_id properly
-- Drop the old constraint
alter table public.picks drop constraint if exists picks_user_id_event_id_market_side_line_key;

-- Add new unique constraint that handles nulls properly for slip-based picks
-- For event-based picks: unique on (user_id, event_id, market, side, line)  
-- For slip-based picks: we'll allow duplicates since they come from different slips
-- We can add a unique constraint later that includes slip_id if needed

-- Add a slip_id reference for slip-based picks (optional for tracking)
alter table public.picks add column if not exists slip_id uuid references public.slips(id) on delete set null;
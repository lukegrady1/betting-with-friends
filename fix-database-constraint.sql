-- Fix for database constraint error
-- Run this in your Supabase SQL editor to add the missing unique constraint

-- Add unique constraint for external events (allows upsert operations to work)
create unique index if not exists events_external_unique 
  on public.events (external_provider, external_id, league_id) 
  where external_provider is not null and external_id is not null;

-- Verify the constraint was created
select 
  schemaname, 
  tablename, 
  indexname, 
  indexdef 
from pg_indexes 
where tablename = 'events' 
  and indexname = 'events_external_unique';
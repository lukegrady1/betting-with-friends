-- Raw slip upload metadata
create table if not exists public.slips (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  storage_path text not null,               -- e.g., slips/{user}/{uuid}.png
  ocr_text text,                            -- full text from OCR
  provider text default 'ocrspace',
  status text default 'queued',             -- queued | parsed | failed | confirmed
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Optional: parlay info on slips (stake & payout for the whole ticket)
  parlay_units_staked numeric(10,2),
  parlay_payout numeric(12,2)
);

create table if not exists public.slip_legs (
  id uuid primary key default gen_random_uuid(),
  slip_id uuid not null references public.slips(id) on delete cascade,
  leg_index int not null,                   -- order on the slip
  market text,                              -- moneyline | spread | total | other
  selection text,                           -- e.g., PHI Eagles or O45.5
  side text,                                -- home | away | over | under | team name
  line numeric(8,2),                        -- spread/total line; null for ML
  odds_american int,                        -- -110, +145
  units_staked numeric(10,2),               -- repeated on each leg for singles; for parlays keep on slip
  potential_payout numeric(12,2),
  confidence numeric(4,3),                  -- 0..1
  parsed_json jsonb                         -- full parsed fields for debugging
);

-- Enable RLS on both tables
alter table public.slips enable row level security;
alter table public.slip_legs enable row level security;

-- RLS policies for slips - users can only see their own slips
create policy "slips_owner_read" on public.slips for select using (user_id = auth.uid());
create policy "slips_owner_write" on public.slips for insert with check (user_id = auth.uid());
create policy "slips_owner_update" on public.slips for update using (user_id = auth.uid());

-- RLS policies for slip_legs - users can only see legs from their own slips
create policy "legs_owner_read" on public.slip_legs for select using (
  exists(select 1 from public.slips s where s.id = slip_id and s.user_id = auth.uid())
);
create policy "legs_owner_write" on public.slip_legs for insert with check (
  exists(select 1 from public.slips s where s.id = slip_id and s.user_id = auth.uid())
);

-- Add indexes for better performance
create index if not exists slips_user_id_idx on public.slips(user_id);
create index if not exists slips_league_id_idx on public.slips(league_id);
create index if not exists slips_status_idx on public.slips(status);
create index if not exists slip_legs_slip_id_idx on public.slip_legs(slip_id);

-- Add updated_at trigger for slips
create trigger set_timestamp_slips before update on public.slips for each row execute procedure moddatetime (updated_at);
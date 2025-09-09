# Bet Slip Upload → OCR → Structured Picks (Edge + Supabase)

> **Goal:** Replace Events entry with a **photo/screenshot upload** of sportsbook slips. An Edge Function extracts **what the bet is**, **who it’s on**, **line/odds**, and **stake**. Parsed legs are confirmed in‑app and then written to `picks` for stats and profit/loss.

---

## 0) Overview

1. **Upload** slip image → Supabase **Storage** (`slips/` bucket).
2. Create `slips` row (`status='queued'`).
3. Invoke Edge Function **`parse-slip`** with `{slip_id}`.
4. Edge calls OCR provider (free tier option), normalizes text, and **parses** legs (supports Moneyline/Spread/Total singles + multi‑leg parlays).
5. Store raw OCR text + structured `slip_legs` with **confidence**.
6. UI shows a **confirm sheet** to fix any fields; on confirm → insert into `picks`.

> MVP OCR Provider: **OCR.Space** free tier (simple, key via env). Swap later for Claude Vision / Textract / Google Vision with the same interface.

---

## 1) Schema Additions

```sql
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
  updated_at timestamptz default now()
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

-- Optional: parlay info on slips (stake & payout for the whole ticket)
alter table public.slips add column if not exists parlay_units_staked numeric(10,2);
alter table public.slips add column if not exists parlay_payout numeric(12,2);
```

**RLS** (mirror picks):

```sql
alter table public.slips enable row level security;
alter table public.slip_legs enable row level security;

create policy "slips_owner_read" on public.slips for select using (user_id = auth.uid());
create policy "slips_owner_write" on public.slips for insert with check (user_id = auth.uid());
create policy "slips_owner_update" on public.slips for update using (user_id = auth.uid());

create policy "legs_owner_read" on public.slip_legs for select using (
  exists(select 1 from public.slips s where s.id = slip_id and s.user_id = auth.uid())
);
create policy "legs_owner_write" on public.slip_legs for insert with check (
  exists(select 1 from public.slips s where s.id = slip_id and s.user_id = auth.uid())
);
```

---

## 2) Storage & Upload (client)

* Bucket: **`slips`** (public disabled).
* After `supabase.storage.from('slips').upload(...)`, insert `slips` row and call the Edge function.

```ts
// src/lib/slips.ts
export async function uploadSlip({ file, leagueId, userId }) {
  const path = `slips/${userId}/${crypto.randomUUID()}.${file.name.split('.').pop()}`;
  const { data: up, error: upErr } = await supabase.storage.from('slips').upload(path, file, { cacheControl: '3600' });
  if (upErr) throw upErr;
  const { data: slip } = await supabase.from('slips').insert({ league_id: leagueId, user_id: userId, storage_path: path }).select().single();
  await fetch(`${import.meta.env.VITE_PUBLIC_FUNCTIONS_URL}/parse-slip`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slip_id: slip.id })
  });
  return slip;
}
```

---

## 3) Edge Function `parse-slip`

**File:** `supabase/functions/parse-slip/index.ts` (Deno)

```ts
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OCRSPACE_KEY = Deno.env.get('OCRSPACE_API_KEY')!; // get free key from ocr.space

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

async function getSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from('slips').createSignedUrl(path, 60 * 10);
  if (error) throw error; return data.signedUrl;
}

async function ocrImage(url: string) {
  const form = new FormData();
  form.set('apikey', OCRSPACE_KEY);
  form.set('url', url);
  form.set('OCREngine', '2'); // better engine on free tier
  form.set('isOverlayRequired', 'false');
  const r = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: form });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  const j = await r.json();
  const text = j?.ParsedResults?.[0]?.ParsedText as string ?? '';
  return text.replace(/\r/g, '').replace(/\t/g, ' ');
}

// --- Parsing helpers --- //
const money = /(?:\$|USD\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/i;
const americanOdds = /([+-]\s?\d{2,4})/;
const spread = /([A-Z]{2,3}).{0,12}([+-]\d{1,2}(?:\.5)?)/; // e.g., PHI -2.5
const totalOver = /\bOver\s*(\d{1,2}(?:\.5)?)\b/i;
const totalUnder = /\bUnder\s*(\d{1,2}(?:\.5)?)\b/i;
const teamLine = /\b([A-Z]{2,3})\b/; // 2–3 letter code heuristic

function parseLines(ocr: string) {
  const lines = ocr.split(/\n+/).map(s => s.trim()).filter(Boolean);
  const legs: any[] = [];
  let stake: number | undefined;
  let payout: number | undefined;

  // heuristic: find stake/payout
  for (const l of lines) {
    if (/stake|risk|wager/i.test(l)) {
      const m = l.match(money); if (m) stake = Number(m[1].replace(/,/g, ''));
    }
    if (/to\s*win|payout|return/i.test(l)) {
      const m2 = l.match(money); if (m2) payout = Number(m2[1].replace(/,/g, ''));
    }
  }

  // leg detection
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // Totals
    let m;
    if ((m = l.match(totalOver))) {
      const odds = (lines[i+1] || '').match(americanOdds)?.[1] ?? l.match(americanOdds)?.[1];
      legs.push({ market: 'total', side: 'over', line: Number(m[1]), odds_american: odds ? Number(odds.replace(/\s+/g,'')) : undefined, selection: `Over ${m[1]}` });
      continue;
    }
    if ((m = l.match(totalUnder))) {
      const odds = (lines[i+1] || '').match(americanOdds)?.[1] ?? l.match(americanOdds)?.[1];
      legs.push({ market: 'total', side: 'under', line: Number(m[1]), odds_american: odds ? Number(odds.replace(/\s+/g,'')) : undefined, selection: `Under ${m[1]}` });
      continue;
    }
    // Spread
    if ((m = l.match(spread))) {
      const odds = (lines[i+1] || '').match(americanOdds)?.[1] ?? l.match(americanOdds)?.[1];
      legs.push({ market: 'spread', side: m[2].startsWith('-') ? 'home' : 'away', line: Number(m[2]), odds_american: odds ? Number(odds.replace(/\s+/g,'')) : undefined, selection: m[1] });
      continue;
    }
    // Moneyline
    const team = l.match(teamLine)?.[1];
    const odds = l.match(americanOdds)?.[1];
    if (team && odds && !/over|under/i.test(l)) {
      legs.push({ market: 'moneyline', side: 'team', line: null, odds_american: Number(odds.replace(/\s+/g,'')), selection: team });
    }
  }

  // attach stake to single leg
  if (legs.length === 1 && stake != null) legs[0].units_staked = stake;
  return { legs, stake, payout };
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') return new Response('POST only', { status: 405 });
    const { slip_id } = await req.json();
    if (!slip_id) return new Response('Missing slip_id', { status: 400 });

    const { data: slip, error: gErr } = await supabase.from('slips').select('*').eq('id', slip_id).single();
    if (gErr || !slip) throw gErr ?? new Error('Slip not found');

    const signed = await getSignedUrl(slip.storage_path);
    const ocrText = await ocrImage(signed);

    const { legs, stake, payout } = parseLines(ocrText);

    // Persist
    await supabase.from('slips').update({ ocr_text: ocrText, status: 'parsed', parlay_units_staked: stake ?? null, parlay_payout: payout ?? null, updated_at: new Date().toISOString() }).eq('id', slip_id);

    if (legs.length) {
      const rows = legs.map((leg: any, i: number) => ({
        slip_id, leg_index: i, market: leg.market, selection: leg.selection, side: leg.side, line: leg.line, odds_american: leg.odds_american ?? null, units_staked: leg.units_staked ?? null, potential_payout: null, confidence: 0.6, parsed_json: leg
      }));
      const { error: insErr } = await supabase.from('slip_legs').insert(rows);
      if (insErr) throw insErr;
    }

    return new Response(JSON.stringify({ ok: true, slip_id, legs_count: legs.length }), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
});
```

**Secrets** to set in Dashboard → Functions → Secrets:

```
OCRSPACE_API_KEY = <your key>
SUPABASE_SERVICE_ROLE_KEY = ...
SUPABASE_URL = https://<project>.supabase.co
```

---

## 4) UI — Upload & Confirm

### 4.1 Upload card

```tsx
// src/routes/leagues/PicksUpload.tsx
import { useState } from 'react';
import { uploadSlip } from '@/lib/slips';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function PicksUpload({ leagueId, userId }) {
  const [file, setFile] = useState<File | null>(null);
  const [slip, setSlip] = useState<any>(null);
  return (
    <Card className="soft p-4 space-y-3">
      <input type="file" accept="image/*" onChange={e=>setFile(e.target.files?.[0] ?? null)} />
      <Button onClick={async()=> file && setSlip(await uploadSlip({ file, leagueId, userId }))} disabled={!file} className="rounded-xl">Upload slip</Button>
      {slip && <p className="text-sm text-muted-foreground">Parsing… refresh in a few seconds.</p>}
    </Card>
  );
}
```

### 4.2 Confirm parsed legs → `picks`

```tsx
// src/routes/leagues/ConfirmSlip.tsx (modal/sheet)
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export function ConfirmSlip({ slipId, leagueId, onDone }) {
  const { data: legs = [] } = useQuery({
    queryKey: ['slip-legs', slipId],
    queryFn: async () => (await supabase.from('slip_legs').select('*').eq('slip_id', slipId).order('leg_index')).data ?? []
  });

  async function confirm() {
    const session = (await supabase.auth.getSession()).data.session!;
    const rows = legs.map((l:any)=>({
      league_id: leagueId,
      event_id: null,              // unknown when uploading slips
      user_id: session.user.id,
      market: l.market,
      side: l.side,
      line: l.line,
      odds_american: l.odds_american,
      units_staked: l.units_staked ?? null, // for parlays leave null or set from slip
      result: 'pending',
    }));
    const { error } = await supabase.from('picks').insert(rows);
    if (error) throw error;
    await supabase.from('slips').update({ status: 'confirmed' }).eq('id', slipId);
    onDone?.();
  }

  return (
    <div className="space-y-3">
      {legs.map((l:any)=> (
        <div key={l.id} className="card p-3">
          <div className="font-medium">{l.market?.toUpperCase()} — {l.selection} {l.line ?? ''} {l.odds_american ? `(${l.odds_american})` : ''}</div>
          <div className="text-sm text-muted-foreground">Stake: {l.units_staked ?? '—'}</div>
        </div>
      ))}
      <Button onClick={confirm} className="rounded-xl">Confirm & Save Picks</Button>
    </div>
  );
}
```

---

## 5) Profit/Loss handling

* For **single bets**: each leg carries its own `units_staked`.
* For **parlays**: store `parlay_units_staked` on `slips`; you can either (a) not insert `picks` until the parlay settles, or (b) insert a synthetic `market='parlay'` pick with combined odds. MVP: handle **singles first**.

**American odds → profit units** (same as existing):

```
win: units * (odds>0 ? odds/100 : 100/abs(odds))
loss: -units
push: 0
```

---

## 6) Playwright MCP tests

* Upload flow renders and calls function (mock network).
* After parse, `slip_legs` rows render with expected fields.
* Confirm inserts into `picks` and marks slip `status='confirmed'`.

```ts
// tests/slip.spec.ts
import { test, expect } from '@playwright/test';

test('upload slip → parsed legs → confirm', async ({ page }) => {
  await page.goto('http://localhost:5173/leagues/LEAGUE_ID/picks');
  const filePath = 'tests/fixtures/dk_single_ml.png';
  await page.setInputFiles('input[type="file"]', filePath);
  await page.getByRole('button', { name: /upload slip/i }).click();
  // In real test, poll for parsed state or mock fetch.
  await expect(page.getByText(/Confirm & Save Picks/i)).toBeVisible({ timeout: 30000 });
});
```

---

## 7) Enhancements (later)

* Add sportsbook **detector** (DraftKings/FanDuel/BetMGM) using keywords; apply book‑specific regexes.
* Vision‑LLM pass for **key‑value extraction** (e.g., “Stake”, “Odds”, “Potential Payout”).
* Image preprocessing (deskew/contrast) before OCR.
* Support **player props** parsing and multi‑leg **parlays** with combined odds.
* Use

  * **Claude Vision** or **GPT‑4o** endpoint for harder slips (fallback when regex confidence < 0.6).
* Store **confidence** per field and require user confirmation when < 0.8.

---

## 8) Acceptance Criteria

* [ ] User uploads a slip image and sees parsed legs (singles) with market, selection, odds, line, and stake.
* [ ] User can edit fields before saving; confirmed legs write to `picks`.
* [ ] No provider keys leaked to the browser.
* [ ] Profit/Loss aggregates off the inserted picks unchanged.

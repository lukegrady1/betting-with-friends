// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OCRSPACE_KEY = Deno.env.get('OCRSPACE_API_KEY')!; // get free key from ocr.space

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from('slips').createSignedUrl(path, 60 * 10);
  if (error) throw error; 
  return data.signedUrl;
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
      const m = l.match(money); 
      if (m) stake = Number(m[1].replace(/,/g, ''));
    }
    if (/to\s*win|payout|return/i.test(l)) {
      const m2 = l.match(money); 
      if (m2) payout = Number(m2[1].replace(/,/g, ''));
    }
  }

  // leg detection
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    // Totals
    let m;
    if ((m = l.match(totalOver))) {
      const odds = (lines[i+1] || '').match(americanOdds)?.[1] ?? l.match(americanOdds)?.[1];
      legs.push({ 
        market: 'total', 
        side: 'over', 
        line: Number(m[1]), 
        odds_american: odds ? Number(odds.replace(/\s+/g,'')) : undefined, 
        selection: `Over ${m[1]}` 
      });
      continue;
    }
    if ((m = l.match(totalUnder))) {
      const odds = (lines[i+1] || '').match(americanOdds)?.[1] ?? l.match(americanOdds)?.[1];
      legs.push({ 
        market: 'total', 
        side: 'under', 
        line: Number(m[1]), 
        odds_american: odds ? Number(odds.replace(/\s+/g,'')) : undefined, 
        selection: `Under ${m[1]}` 
      });
      continue;
    }
    // Spread
    if ((m = l.match(spread))) {
      const odds = (lines[i+1] || '').match(americanOdds)?.[1] ?? l.match(americanOdds)?.[1];
      legs.push({ 
        market: 'spread', 
        side: m[2].startsWith('-') ? 'home' : 'away', 
        line: Number(m[2]), 
        odds_american: odds ? Number(odds.replace(/\s+/g,'')) : undefined, 
        selection: m[1] 
      });
      continue;
    }
    // Moneyline
    const team = l.match(teamLine)?.[1];
    const odds = l.match(americanOdds)?.[1];
    if (team && odds && !/over|under/i.test(l)) {
      legs.push({ 
        market: 'moneyline', 
        side: 'team', 
        line: null, 
        odds_american: Number(odds.replace(/\s+/g,'')), 
        selection: team 
      });
    }
  }

  // attach stake to single leg
  if (legs.length === 1 && stake != null) legs[0].units_staked = stake;
  return { legs, stake, payout };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response('POST only', { 
        status: 405, 
        headers: { ...corsHeaders, 'content-type': 'application/json' }
      });
    }
    
    const { slip_id } = await req.json();
    if (!slip_id) {
      return new Response(JSON.stringify({ error: 'Missing slip_id' }), { 
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' }
      });
    }

    const { data: slip, error: gErr } = await supabase.from('slips').select('*').eq('id', slip_id).single();
    if (gErr || !slip) {
      throw gErr ?? new Error('Slip not found');
    }

    // Update status to show processing started
    await supabase.from('slips').update({ 
      status: 'processing', 
      updated_at: new Date().toISOString() 
    }).eq('id', slip_id);

    const signed = await getSignedUrl(slip.storage_path);
    const ocrText = await ocrImage(signed);

    const { legs, stake, payout } = parseLines(ocrText);

    // Persist OCR results
    await supabase.from('slips').update({ 
      ocr_text: ocrText, 
      status: 'parsed', 
      parlay_units_staked: stake ?? null, 
      parlay_payout: payout ?? null, 
      updated_at: new Date().toISOString() 
    }).eq('id', slip_id);

    // Insert parsed legs
    if (legs.length) {
      const rows = legs.map((leg: any, i: number) => ({
        slip_id, 
        leg_index: i, 
        market: leg.market, 
        selection: leg.selection, 
        side: leg.side, 
        line: leg.line, 
        odds_american: leg.odds_american ?? null, 
        units_staked: leg.units_staked ?? null, 
        potential_payout: null, 
        confidence: 0.6, 
        parsed_json: leg
      }));
      const { error: insErr } = await supabase.from('slip_legs').insert(rows);
      if (insErr) throw insErr;
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      slip_id, 
      legs_count: legs.length,
      ocr_text: ocrText
    }), { 
      headers: { ...corsHeaders, 'content-type': 'application/json' } 
    });
    
  } catch (e) {
    console.error('Parse slip error:', e);
    
    // Try to update slip status to failed if we have a slip_id
    try {
      const body = await req.clone().json();
      if (body.slip_id) {
        await supabase.from('slips').update({ 
          status: 'failed', 
          error: String(e),
          updated_at: new Date().toISOString() 
        }).eq('id', body.slip_id);
      }
    } catch {
      // Ignore errors in error handling
    }
    
    return new Response(JSON.stringify({ 
      ok: false, 
      error: String(e) 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'content-type': 'application/json' } 
    });
  }
});
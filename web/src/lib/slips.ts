// Client utilities for slip upload and OCR processing
import { supabase } from './supabase';

export interface SlipUpload {
  file: File;
  leagueId: string;
  userId: string;
}

export interface Slip {
  id: string;
  league_id: string;
  user_id: string;
  storage_path: string;
  ocr_text?: string;
  provider: string;
  status: 'queued' | 'processing' | 'parsed' | 'failed' | 'confirmed';
  error?: string;
  created_at: string;
  updated_at: string;
  parlay_units_staked?: number;
  parlay_payout?: number;
}

export interface SlipLeg {
  id: string;
  slip_id: string;
  leg_index: number;
  market?: string;
  selection?: string;
  side?: string;
  line?: number;
  odds_american?: number;
  units_staked?: number;
  potential_payout?: number;
  confidence: number;
  parsed_json: any;
}

export async function uploadSlip({ file, leagueId, userId }: SlipUpload): Promise<Slip> {
  // Verify authentication first
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error('Authentication required for file upload');
  }
  
  console.log('Upload session check:', { 
    userId: session.user.id, 
    providedUserId: userId,
    authenticated: !!session 
  });

  // Generate unique file path
  const fileExtension = file.name.split('.').pop() || 'png';
  const fileName = `${crypto.randomUUID()}.${fileExtension}`;
  const path = `slips/${userId}/${fileName}`;
  
  // Upload file to storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('slips')
    .upload(path, file, { 
      cacheControl: '3600',
      upsert: false
    });
    
  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    console.error('Upload path:', path);
    console.error('File details:', { name: file.name, size: file.size, type: file.type });
    throw new Error(`Failed to upload file: ${uploadError.message} (Details: ${JSON.stringify(uploadError)})`);
  }
  
  // Create slip record
  const { data: slip, error: slipError } = await supabase
    .from('slips')
    .insert({
      league_id: leagueId,
      user_id: userId,
      storage_path: path,
      status: 'queued'
    })
    .select()
    .single();
    
  if (slipError) {
    // Clean up uploaded file if slip creation fails
    await supabase.storage.from('slips').remove([path]);
    throw new Error(`Failed to create slip record: ${slipError.message}`);
  }
  
  // Trigger OCR processing
  try {
    const functionsUrl = import.meta.env.VITE_PUBLIC_FUNCTIONS_URL;
    if (!functionsUrl) {
      throw new Error('VITE_PUBLIC_FUNCTIONS_URL environment variable is not set');
    }
    
    const response = await fetch(`${functionsUrl}/bright-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ slip_id: slip.id })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.warn('OCR processing failed (Edge Function not deployed?):', errorData);
      // Update slip status to indicate function not available
      await supabase.from('slips').update({ 
        status: 'failed', 
        error: `OCR function not available (HTTP ${response.status})` 
      }).eq('id', slip.id);
    }
  } catch (error) {
    console.warn('Failed to trigger OCR processing (Edge Function not deployed?):', error);
    // Update slip status to indicate function not available  
    await supabase.from('slips').update({ 
      status: 'failed', 
      error: 'OCR function not available - please deploy bright-service function' 
    }).eq('id', slip.id);
  }
  
  return slip;
}

export async function getSlipWithLegs(slipId: string): Promise<{ slip: Slip; legs: SlipLeg[] } | null> {
  // Get slip data
  const { data: slip, error: slipError } = await supabase
    .from('slips')
    .select('*')
    .eq('id', slipId)
    .single();
    
  if (slipError || !slip) {
    return null;
  }
  
  // Get slip legs
  const { data: legs, error: legsError } = await supabase
    .from('slip_legs')
    .select('*')
    .eq('slip_id', slipId)
    .order('leg_index', { ascending: true });
    
  if (legsError) {
    throw new Error(`Failed to fetch slip legs: ${legsError.message}`);
  }
  
  return { slip, legs: legs || [] };
}

export async function confirmSlipLegs(slipId: string, leagueId: string, legs: SlipLeg[]): Promise<void> {
  // Get current session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    throw new Error('Authentication required');
  }
  
  // Convert legs to picks
  const picks = legs
    .filter(leg => leg.market && leg.odds_american) // Only include valid legs
    .map(leg => ({
      league_id: leagueId,
      event_id: null, // No event_id when uploading slips
      user_id: session.user.id,
      market: leg.market!,
      side: leg.side || 'team',
      line: leg.line || null,
      odds_american: leg.odds_american!,
      units_staked: leg.units_staked && leg.units_staked > 0 ? leg.units_staked : null, // Handle units validation
      result: 'pending' as const,
      slip_id: slipId, // Reference back to the original slip
    }));
    
  if (picks.length === 0) {
    throw new Error('No valid legs to convert to picks');
  }
  
  // Debug logging
  console.log('Attempting to insert picks:', picks);
  console.log('Session user:', session.user.id);
  console.log('League ID:', leagueId);

  // Insert picks
  const { error: picksError } = await supabase
    .from('picks')
    .insert(picks);
    
  if (picksError) {
    console.error('Pick insertion error details:', picksError);
    console.error('Pick data that failed:', picks);
    throw new Error(`Failed to create picks: ${JSON.stringify(picksError)}`);
  }
  
  // Mark slip as confirmed
  const { error: updateError } = await supabase
    .from('slips')
    .update({ 
      status: 'confirmed',
      updated_at: new Date().toISOString()
    })
    .eq('id', slipId);
    
  if (updateError) {
    throw new Error(`Failed to update slip status: ${updateError.message}`);
  }
}

export async function retrySlipParsing(slipId: string): Promise<void> {
  try {
    const functionsUrl = import.meta.env.VITE_PUBLIC_FUNCTIONS_URL;
    if (!functionsUrl) {
      throw new Error('VITE_PUBLIC_FUNCTIONS_URL environment variable is not set');
    }
    
    const response = await fetch(`${functionsUrl}/bright-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slip_id: slipId })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to retry parsing');
    }
  } catch (error) {
    throw new Error(`Failed to retry slip parsing: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function getSlipImageUrl(slip: Slip): Promise<string> {
  return supabase.storage
    .from('slips')
    .createSignedUrl(slip.storage_path, 60 * 60) // 1 hour
    .then(({ data, error }) => {
      if (error) throw error;
      return data.signedUrl;
    });
}
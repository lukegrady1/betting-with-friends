-- Fix RLS policies to prevent infinite recursion
-- Run this in your Supabase SQL editor to fix the circular reference issue

-- Drop the problematic policies
DROP POLICY IF EXISTS "leagues_select_member" ON public.leagues;
DROP POLICY IF EXISTS "lm_select_self_leagues" ON public.league_members;

-- Recreate leagues policies (creator can always see, members via explicit check)
CREATE POLICY "leagues_select_member" ON public.leagues
  FOR SELECT USING ( 
    created_by = auth.uid() OR 
    EXISTS(
      SELECT 1 FROM public.league_members lm
      WHERE lm.league_id = id AND lm.user_id = auth.uid()
    )
  );

-- Recreate league_members policy (users can only see their own membership records)
CREATE POLICY "lm_select_self_or_member" ON public.league_members
  FOR SELECT USING (user_id = auth.uid());

-- Add missing policies for league_members updates/deletes
CREATE POLICY "lm_update_self" ON public.league_members
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "lm_delete_self_or_admin" ON public.league_members
  FOR DELETE USING (
    user_id = auth.uid() OR 
    EXISTS(
      SELECT 1 FROM public.leagues l
      WHERE l.id = league_id AND l.created_by = auth.uid()
    )
  );
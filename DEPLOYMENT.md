# NFL Integration Deployment Guide

This guide walks through deploying the NFL integration to your Supabase project.

## Prerequisites

- SportsDataIO API key (from https://sportsdata.io/)
- Supabase CLI installed (`npm install -g supabase`)
- Access to your Supabase project

## Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

## Step 2: Login and Link Project

```bash
# Login to Supabase
supabase login

# Link your project (replace with your actual project reference)
supabase link --project-ref aqxaghkhswerbcizblnp
```

## Step 3: Deploy Database Migrations

Run the NFL integration migration in your Supabase SQL editor:

```sql
-- Copy and paste the contents of supabase/migrations/030_events_nfl_integration.sql
```

Or if you have Supabase CLI configured locally:

```bash
supabase db push
```

## Step 4: Deploy Edge Function

```bash
# Deploy the NFL sync function
supabase functions deploy nfl-sync-week
```

## Step 5: Configure SportsDataIO API Key

```bash
# Set the API key as a Supabase secret
supabase secrets set SPORTSDATAIO_API_KEY=your_actual_api_key_here
```

Replace `your_actual_api_key_here` with your actual SportsDataIO API key.

## Step 6: Verify Configuration

1. Go to your Supabase dashboard
2. Navigate to Edge Functions
3. Confirm `nfl-sync-week` function is deployed
4. Navigate to Project Settings → Environment variables
5. Confirm `SPORTSDATAIO_API_KEY` is set

## Step 7: Test NFL Sync

1. Make sure you're a league admin in your app
2. Navigate to the Events page
3. Click "Sync NFL Week" button
4. Verify NFL games are loaded

## Troubleshooting

**Function not found error:**
- Verify the Edge Function is deployed: `supabase functions list`
- Check the functions URL in your `.env` file

**API key error:**
- Verify the secret is set: `supabase secrets list`
- Check your SportsDataIO account has an active subscription

**Permission errors:**
- Ensure you're a league admin to access the sync button
- Verify your user has proper league membership

## Environment Variables Summary

Your `.env` file should contain:

```
VITE_SUPABASE_URL=https://aqxaghkhswerbcizblnp.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_PUBLIC_FUNCTIONS_URL=https://aqxaghkhswerbcizblnp.supabase.co/functions/v1
```

The `SPORTSDATAIO_API_KEY` should be configured as a Supabase secret, not in the frontend `.env` file.
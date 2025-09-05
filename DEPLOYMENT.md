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

## Step 5: Configure Environment Secrets

```bash
# Set the SportsDataIO API key as a Supabase secret
supabase secrets set SPORTSDATAIO_API_KEY=your_actual_api_key_here

# Set the Supabase anon key (needed for authentication verification)
supabase secrets set SUPABASE_ANON_KEY=your_supabase_anon_key
```

Replace with your actual values:
- `your_actual_api_key_here` - Your SportsDataIO API key
- `your_supabase_anon_key` - Your Supabase anon key (same as in your .env file)

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
- Verify the secrets are set: `supabase secrets list`
- Check your SportsDataIO account has an active subscription

**Authentication errors:**
- Make sure you're logged into your app
- Verify the SUPABASE_ANON_KEY secret is set correctly

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

The `SPORTSDATAIO_API_KEY` and `SUPABASE_ANON_KEY` should be configured as Supabase secrets, not in the frontend `.env` file.
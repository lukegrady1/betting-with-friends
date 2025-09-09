# Storage Bucket Setup for Slip OCR

The RLS error you're seeing is likely because the `slips` storage bucket doesn't exist yet. Here's how to fix it:

## Option 1: Create Bucket via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New Bucket**
4. Use these settings:
   - **Name**: `slips`
   - **Public**: `false` (keep it private)
   - **File size limit**: `5242880` (5MB)
   - **Allowed MIME types**: `image/jpeg,image/png,image/webp,image/heic`

## Option 2: Create Bucket via SQL

If you prefer SQL, run this in your SQL editor:

```sql
-- Create the slips bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'slips',
  'slips', 
  false, -- private bucket
  5242880, -- 5MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;
```

## Apply the RLS Policies

After creating the bucket, apply the storage policies by running the migrations:

```bash
# Apply the database migrations
supabase db push

# Or run the SQL files manually in the Supabase SQL editor:
# - 022_slip_ocr_schema.sql
# - 023_slip_storage_bucket.sql  
# - 024_fix_slip_storage_policies.sql
```

## Verify Setup

Once done, try uploading a slip again. If you still get errors, check the browser console for more detailed error information (I've added debug logging).

## Alternative: Temporary Public Bucket (For Testing Only)

If you want to test quickly without RLS policies, you can temporarily make the bucket public:

1. In Supabase Dashboard → Storage → slips bucket
2. Click "Settings" 
3. Toggle "Public bucket" to ON
4. **Remember to turn this back to private after testing!**

The slip upload should work after creating the bucket and applying the RLS policies.
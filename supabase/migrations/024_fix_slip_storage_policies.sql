-- Drop existing policies if they exist
drop policy if exists "Users can upload slip images" on storage.objects;
drop policy if exists "Users can view their own slip images" on storage.objects;
drop policy if exists "Users can update their own slip images" on storage.objects;
drop policy if exists "Users can delete their own slip images" on storage.objects;

-- Create simpler, more reliable storage policies for slip uploads
create policy "Allow authenticated users to upload to slips bucket"
on storage.objects for insert
with check (
  bucket_id = 'slips' 
  and auth.uid()::text is not null
  and (
    -- Allow uploads to user's own folder within slips
    name ~ ('^slips/' || auth.uid()::text || '/.*')
    or
    -- Allow uploads directly in user folder (fallback)
    name ~ ('^' || auth.uid()::text || '/.*')
  )
);

create policy "Allow users to view their own slip images"
on storage.objects for select
using (
  bucket_id = 'slips' 
  and auth.uid()::text is not null
  and (
    -- Allow access to user's own folder within slips
    name ~ ('^slips/' || auth.uid()::text || '/.*')
    or
    -- Allow access directly in user folder (fallback)
    name ~ ('^' || auth.uid()::text || '/.*')
  )
);

create policy "Allow users to update their own slip images"
on storage.objects for update
using (
  bucket_id = 'slips' 
  and auth.uid()::text is not null
  and (
    -- Allow updates to user's own folder within slips
    name ~ ('^slips/' || auth.uid()::text || '/.*')
    or
    -- Allow updates directly in user folder (fallback)
    name ~ ('^' || auth.uid()::text || '/.*')
  )
);

create policy "Allow users to delete their own slip images"
on storage.objects for delete
using (
  bucket_id = 'slips' 
  and auth.uid()::text is not null
  and (
    -- Allow deletes from user's own folder within slips
    name ~ ('^slips/' || auth.uid()::text || '/.*')
    or
    -- Allow deletes directly in user folder (fallback)
    name ~ ('^' || auth.uid()::text || '/.*')
  )
);

-- Grant necessary permissions
grant usage on schema storage to authenticated;
grant all on storage.objects to authenticated;
grant all on storage.buckets to authenticated;
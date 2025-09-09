-- Create storage bucket for slip images
-- Note: This is typically done via Supabase Dashboard, but can be done via SQL

-- Create the slips bucket if it doesn't exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'slips',
  'slips', 
  false, -- private bucket
  5242880, -- 5MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- RLS policies for storage bucket access
-- Users can only upload to their own folder and read their own files
create policy "Users can upload slip images"
on storage.objects for insert
with check (
  bucket_id = 'slips' 
  and auth.role() = 'authenticated'
  and (name like 'slips/' || auth.uid()::text || '/%' or name like auth.uid()::text || '/%')
);

create policy "Users can view their own slip images"
on storage.objects for select
using (
  bucket_id = 'slips' 
  and auth.role() = 'authenticated'
  and (name like 'slips/' || auth.uid()::text || '/%' or name like auth.uid()::text || '/%')
);

create policy "Users can update their own slip images"
on storage.objects for update
using (
  bucket_id = 'slips' 
  and auth.role() = 'authenticated'
  and (name like 'slips/' || auth.uid()::text || '/%' or name like auth.uid()::text || '/%')
);

create policy "Users can delete their own slip images"
on storage.objects for delete
using (
  bucket_id = 'slips' 
  and auth.role() = 'authenticated'
  and (name like 'slips/' || auth.uid()::text || '/%' or name like auth.uid()::text || '/%')
);
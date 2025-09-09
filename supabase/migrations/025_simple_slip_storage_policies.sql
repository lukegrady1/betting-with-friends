-- Drop all existing storage policies for slips bucket
drop policy if exists "Allow authenticated users to upload to slips bucket" on storage.objects;
drop policy if exists "Allow users to view their own slip images" on storage.objects;
drop policy if exists "Allow users to update their own slip images" on storage.objects;
drop policy if exists "Allow users to delete their own slip images" on storage.objects;

-- Very simple and permissive policies for authenticated users
create policy "Authenticated users can upload to slips"
on storage.objects for insert
with check (
  bucket_id = 'slips' 
  and auth.role() = 'authenticated'
);

create policy "Authenticated users can view slips"
on storage.objects for select
using (
  bucket_id = 'slips' 
  and auth.role() = 'authenticated'
);

create policy "Authenticated users can update slips"
on storage.objects for update
using (
  bucket_id = 'slips' 
  and auth.role() = 'authenticated'
);

create policy "Authenticated users can delete slips"
on storage.objects for delete
using (
  bucket_id = 'slips' 
  and auth.role() = 'authenticated'
);
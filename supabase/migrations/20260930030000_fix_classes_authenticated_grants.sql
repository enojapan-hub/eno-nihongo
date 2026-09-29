-- Allow authenticated users to use the existing row-level security policies
-- when listing classes or updating teacher class submissions.
grant select, update on table public.classes to authenticated;

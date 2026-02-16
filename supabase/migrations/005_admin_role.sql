-- Promote a profile to admin role.
--
-- The enforce_profile_immutable_fields trigger prevents role changes via
-- normal UPDATE, so we temporarily disable it for this migration.
--
-- Replace 'YOUR_EMAIL_HERE' with the email of the account to promote.

alter table public.profiles disable trigger enforce_profile_immutable_fields;

update public.profiles
   set role = 'admin',
       updated_at = now()
 where email = 'hello@andrewisherwood.com';

alter table public.profiles enable trigger enforce_profile_immutable_fields;

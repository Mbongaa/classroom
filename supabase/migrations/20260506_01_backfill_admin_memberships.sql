-- Ensure existing organization owner/admin accounts keep finance access.
-- New invited translation-only users remain teachers unless explicitly promoted.

insert into public.organization_members (organization_id, user_id, role)
select p.organization_id, p.id, 'admin'
from public.profiles p
where p.organization_id is not null
  and p.role = 'admin'
on conflict (organization_id, user_id)
do update set role = 'admin'
where public.organization_members.role <> 'admin';

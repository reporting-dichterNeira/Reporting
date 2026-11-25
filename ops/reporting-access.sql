begin;
alter table public.portal_requests enable row level security;
grant select, insert on public.portal_requests to anon;
grant select, insert, update, delete on public.portal_requests to authenticated;
drop policy if exists portal_requests_read on public.portal_requests;
drop policy if exists portal_requests_insert on public.portal_requests;
drop policy if exists portal_requests_update on public.portal_requests;
drop policy if exists portal_requests_delete on public.portal_requests;
drop policy if exists reporting_admin on public.portal_requests;
create policy reporting_admin on public.portal_requests for all to authenticated
  using ((select auth.uid()) = 'c7ae61e5-0319-4e35-9d1c-d4131ae79a3f'::uuid)
  with check ((select auth.uid()) = 'c7ae61e5-0319-4e35-9d1c-d4131ae79a3f'::uuid);
-- The public ticket history still reads request rows across devices.
create policy portal_requests_read on public.portal_requests for select to anon
  using (left(id, 12) <> 'PORTAL_META_' or id = 'PORTAL_META_ANALYST_STATUS_V1');
create policy portal_requests_insert on public.portal_requests for insert to anon
  with check (
    id ~ '^REQ-[0-9]{4}-[0-9]{3}$'
    and payload->>'id' = id
    and payload->>'status' = 'PENDING'
    and payload->>'category' in ('ENCOLADA', 'BI_EXISTING', 'BI_EXISTING_INCIDENT', 'BI_NEW', 'BI_SPORADIC')
    and payload->>'analyst' is null
    and payload->>'ticketNumber' is null
    and payload->>'resolvedAt' is null
  );
revoke update, delete on public.portal_requests from anon;
commit;

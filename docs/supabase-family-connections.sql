-- Execute uma vez no SQL Editor do Supabase.
-- Permite que duas famílias enviem, aceitem e recusem convites de conexão.

create table if not exists family_connection_requests (
  id uuid primary key default gen_random_uuid(),
  requester_household_id uuid not null references households(id) on delete cascade,
  target_household_id uuid not null references households(id) on delete cascade,
  requested_by_resident_id uuid not null references residents(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_household_id <> target_household_id)
);

create index if not exists family_connection_requests_requester_idx
on family_connection_requests (requester_household_id, status);

create index if not exists family_connection_requests_target_idx
on family_connection_requests (target_household_id, status);

create unique index if not exists family_connection_requests_active_pair_idx
on family_connection_requests (
  least(requester_household_id, target_household_id),
  greatest(requester_household_id, target_household_id)
)
where status in ('pending', 'accepted');

alter table family_connection_requests enable row level security;

drop policy if exists "mvp family connections all" on family_connection_requests;

create policy "mvp family connections all"
on family_connection_requests for all
to anon, authenticated
using (true)
with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'family_connection_requests'
  ) then
    alter publication supabase_realtime add table family_connection_requests;
  end if;
end
$$;

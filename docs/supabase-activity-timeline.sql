-- Execute uma vez no SQL Editor do Supabase para persistir a timeline da casa.
create table if not exists activity_events (
  id uuid primary key,
  household_id uuid not null references households(id) on delete cascade,
  resident_id uuid not null references residents(id) on delete cascade,
  kind text not null check (kind in ('reminder', 'location', 'birthday', 'resident')),
  title text not null,
  detail text,
  location_share_id uuid references location_shares(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists activity_events_household_created_at_idx
on activity_events (household_id, created_at desc);

alter table activity_events enable row level security;

drop policy if exists "mvp activity events all" on activity_events;

create policy "mvp activity events all"
on activity_events for all
to anon, authenticated
using (true)
with check (true);

-- Habilita os eventos que o app acompanha em tempo real.
do $$
declare
  realtime_table text;
begin
  foreach realtime_table in array array[
    'residents',
    'reminders',
    'birthdays',
    'emergency_contacts',
    'location_shares',
    'activity_events'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = realtime_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        realtime_table
      );
    end if;
  end loop;
end
$$;

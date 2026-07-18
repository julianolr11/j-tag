-- Execute uma vez no SQL Editor do Supabase.

create table if not exists daily_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  resident_id uuid not null references residents(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 240),
  photo_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

alter table daily_messages
add column if not exists expires_at timestamptz;

update daily_messages
set expires_at = created_at + interval '24 hours'
where expires_at is null;

alter table daily_messages
alter column expires_at set default (now() + interval '24 hours');

alter table daily_messages
alter column expires_at set not null;

create index if not exists daily_messages_household_created_at_idx
on daily_messages (household_id, created_at desc);

create index if not exists daily_messages_expires_at_idx
on daily_messages (expires_at);

alter table daily_messages enable row level security;

drop policy if exists "mvp daily messages all" on daily_messages;

create policy "mvp daily messages all"
on daily_messages for all
to anon, authenticated
using (true)
with check (true);

alter table activity_events
add column if not exists message_id uuid
references daily_messages(id)
on delete set null;

alter table activity_events
drop constraint if exists activity_events_kind_check;

alter table activity_events
add constraint activity_events_kind_check
check (kind in ('reminder', 'location', 'birthday', 'resident', 'message'));

create index if not exists activity_events_message_id_idx
on activity_events (message_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'daily_messages'
  ) then
    alter publication supabase_realtime add table public.daily_messages;
  end if;
end
$$;

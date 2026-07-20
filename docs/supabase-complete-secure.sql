-- ============================================================
-- J-TAG — CONFIGURAÇÃO CONSOLIDADA E SEGURA
-- ============================================================
-- Execute no SQL Editor do Supabase em um projeto que já possua
-- as tabelas-base do J-Tag (households, residents, reminders,
-- birthdays e emergency_contacts).
--
-- O script é idempotente e não apaga dados existentes.
-- A service role deve ficar somente no servidor/Vercel.
-- ============================================================

begin;

-- ============================================================
-- 1. COLUNAS E RESTRIÇÕES
-- ============================================================

alter table residents
  add column if not exists theme text not null default 'default',
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

alter table residents drop constraint if exists residents_theme_check;
alter table residents add constraint residents_theme_check
  check (theme in ('default', 'blue-light', 'aurora', 'green-home', 'graphite'));

drop index if exists residents_auth_user_id_unique_idx;
create unique index if not exists residents_household_auth_user_unique_idx
  on residents (household_id, auth_user_id) where auth_user_id is not null;

alter table reminders
  add column if not exists recurrence text,
  add column if not exists visibility text not null default 'household';

alter table reminders drop constraint if exists reminders_recurrence_check;
alter table reminders add constraint reminders_recurrence_check
  check (recurrence is null or recurrence in ('daily', 'weekly', 'monthly', 'yearly'));

alter table reminders drop constraint if exists reminders_visibility_check;
alter table reminders add constraint reminders_visibility_check
  check (visibility in ('private', 'household'));

alter table birthdays
  add column if not exists resident_id uuid references residents(id) on delete set null,
  add column if not exists profile_resident_id uuid references residents(id) on delete cascade,
  add column if not exists visibility text not null default 'household';

alter table birthdays drop constraint if exists birthdays_visibility_check;
alter table birthdays add constraint birthdays_visibility_check
  check (visibility in ('private', 'household'));

create index if not exists birthdays_resident_id_idx on birthdays (resident_id);
create unique index if not exists birthdays_profile_resident_id_idx
  on birthdays (profile_resident_id) where profile_resident_id is not null;

-- ============================================================
-- 2. TABELAS COMPLEMENTARES
-- ============================================================

create table if not exists household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

alter table household_members drop constraint if exists household_members_role_check;
alter table household_members add constraint household_members_role_check
  check (role in ('owner', 'member'));

create index if not exists household_members_user_id_idx
  on household_members (user_id);

create table if not exists account_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null,
  recovery_email text, -- legado: preservado para não apagar dados de contas antigas
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_access_handle_format_check check (
    handle = lower(handle)
    and char_length(handle) between 4 and 32
    and handle ~ '^[a-z0-9][a-z0-9._-]*[a-z0-9]$'
  )
);

alter table account_access
  add column if not exists recovery_email text, -- legado; o fluxo atual usa aprovação interna
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table account_access drop constraint if exists account_access_handle_format_check;
alter table account_access add constraint account_access_handle_format_check check (
  handle = lower(handle)
  and char_length(handle) between 4 and 32
  and handle ~ '^[a-z0-9][a-z0-9._-]*[a-z0-9]$'
);

create unique index if not exists account_access_handle_unique_idx
  on account_access (lower(handle));

create table if not exists location_shares (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  resident_id uuid not null references residents(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists location_shares_household_created_at_idx
  on location_shares (household_id, created_at desc);
create index if not exists location_shares_expires_at_idx
  on location_shares (expires_at);

create table if not exists daily_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  resident_id uuid not null references residents(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 240),
  photo_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

alter table daily_messages drop constraint if exists daily_messages_message_length_check;
alter table daily_messages add constraint daily_messages_message_length_check
  check (char_length(message) between 1 and 240);

alter table daily_messages add column if not exists expires_at timestamptz;
update daily_messages
  set expires_at = created_at + interval '24 hours'
  where expires_at is null;
alter table daily_messages alter column expires_at set default (now() + interval '24 hours');
alter table daily_messages alter column expires_at set not null;

create index if not exists daily_messages_household_created_at_idx
  on daily_messages (household_id, created_at desc);
create index if not exists daily_messages_expires_at_idx
  on daily_messages (expires_at);

create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  resident_id uuid not null references residents(id) on delete cascade,
  kind text not null,
  title text not null,
  detail text,
  reminder_id uuid references reminders(id) on delete set null,
  location_share_id uuid references location_shares(id) on delete set null,
  message_id uuid references daily_messages(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table activity_events
  add column if not exists reminder_id uuid references reminders(id) on delete set null,
  add column if not exists message_id uuid references daily_messages(id) on delete set null;

alter table activity_events drop constraint if exists activity_events_kind_check;
alter table activity_events add constraint activity_events_kind_check
  check (kind in ('reminder', 'location', 'birthday', 'resident', 'message'));

create index if not exists activity_events_household_created_at_idx
  on activity_events (household_id, created_at desc);
create index if not exists activity_events_resident_created_at_idx
  on activity_events (resident_id, created_at desc);
create index if not exists activity_events_reminder_id_idx
  on activity_events (reminder_id);
create index if not exists activity_events_message_id_idx
  on activity_events (message_id);

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
  ) where status in ('pending', 'accepted');

create table if not exists family_direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_household_id uuid not null references households(id) on delete cascade,
  recipient_household_id uuid not null references households(id) on delete cascade,
  sender_resident_id uuid not null references residents(id) on delete cascade,
  recipient_resident_id uuid not null references residents(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 500),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table family_direct_messages
  drop constraint if exists family_direct_messages_check;

create index if not exists family_direct_messages_recipient_idx
  on family_direct_messages (recipient_resident_id, created_at desc);
create index if not exists family_direct_messages_sender_idx
  on family_direct_messages (sender_resident_id, created_at desc);

create table if not exists password_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'completed', 'cancelled')),
  code_hash text,
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table password_recovery_requests
  add column if not exists attempt_count integer not null default 0;
alter table password_recovery_requests drop constraint if exists password_recovery_requests_attempt_count_check;
alter table password_recovery_requests add constraint password_recovery_requests_attempt_count_check
  check (attempt_count between 0 and 5);

create index if not exists password_recovery_requests_target_idx
  on password_recovery_requests (target_user_id, status, created_at desc);
create index if not exists password_recovery_requests_household_idx
  on password_recovery_requests (household_id, status, created_at desc);
with ranked_recovery as (
  select
    id,
    row_number() over (
      partition by target_user_id
      order by created_at desc, id desc
    ) as position
  from password_recovery_requests
  where status in ('pending', 'approved')
)
update password_recovery_requests request
set status = 'cancelled', code_hash = null, updated_at = now()
from ranked_recovery ranked
where request.id = ranked.id
  and ranked.position > 1;
create unique index if not exists password_recovery_requests_one_active_idx
  on password_recovery_requests (target_user_id)
  where status in ('pending', 'approved');

create table if not exists household_join_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  decided_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists household_join_requests_household_idx
  on household_join_requests (household_id, status, created_at desc);
create index if not exists household_join_requests_requester_idx
  on household_join_requests (requester_user_id, status, created_at desc);
with ranked_joins as (
  select
    id,
    row_number() over (
      partition by household_id, requester_user_id
      order by created_at desc, id desc
    ) as position
  from household_join_requests
  where status in ('pending', 'approved')
)
update household_join_requests request
set status = 'cancelled', updated_at = now()
from ranked_joins ranked
where request.id = ranked.id
  and ranked.position > 1;
create unique index if not exists household_join_requests_one_active_idx
  on household_join_requests (household_id, requester_user_id)
  where status in ('pending', 'approved');

-- ============================================================
-- 3. UPDATED_AT AUTOMÁTICO
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists account_access_set_updated_at on account_access;
create trigger account_access_set_updated_at
  before update on account_access
  for each row execute function public.set_updated_at();

drop trigger if exists family_connection_requests_set_updated_at on family_connection_requests;
create trigger family_connection_requests_set_updated_at
  before update on family_connection_requests
  for each row execute function public.set_updated_at();

drop trigger if exists password_recovery_requests_set_updated_at on password_recovery_requests;
create trigger password_recovery_requests_set_updated_at
  before update on password_recovery_requests
  for each row execute function public.set_updated_at();

drop trigger if exists household_join_requests_set_updated_at on household_join_requests;
create trigger household_join_requests_set_updated_at
  before update on household_join_requests
  for each row execute function public.set_updated_at();

-- ============================================================
-- 4. FUNÇÕES AUXILIARES DE AUTORIZAÇÃO
-- ============================================================

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = auth.uid()
  );
$$;

create or replace function public.is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = auth.uid()
      and hm.role = 'owner'
  );
$$;

create or replace function public.is_resident_account(target_resident_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from residents r
    where r.id = target_resident_id
      and r.auth_user_id = auth.uid()
  );
$$;

create or replace function public.is_resident_in_household(
  target_resident_id uuid,
  target_household_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from residents resident
    where resident.id = target_resident_id
      and resident.household_id = target_household_id
  );
$$;

create or replace function public.household_has_members(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from household_members hm
    where hm.household_id = target_household_id
  );
$$;

create or replace function public.is_household_connected(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from family_connection_requests connection
    where connection.status = 'accepted'
      and (
        (
          connection.requester_household_id = target_household_id
          and public.is_household_member(connection.target_household_id)
        )
        or (
          connection.target_household_id = target_household_id
          and public.is_household_member(connection.requester_household_id)
        )
      )
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.is_household_owner(uuid) from public;
revoke all on function public.is_resident_account(uuid) from public;
revoke all on function public.is_resident_in_household(uuid, uuid) from public;
revoke all on function public.household_has_members(uuid) from public;
revoke all on function public.is_household_connected(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.is_resident_account(uuid) to authenticated;
grant execute on function public.is_resident_in_household(uuid, uuid) to authenticated;
grant execute on function public.household_has_members(uuid) to authenticated;
grant execute on function public.is_household_connected(uuid) to authenticated;

-- A rede entre famílias recebe somente dados visuais. PIN e auth_user_id nunca
-- são expostos para uma família conectada.
create or replace view public.family_resident_previews
with (security_barrier = true)
as
select
  id,
  household_id,
  name,
  role,
  color,
  photo_url,
  theme
from residents
where public.is_household_connected(household_id);

revoke all on public.family_resident_previews from public, anon;
grant select on public.family_resident_previews to authenticated;

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

alter table households enable row level security;
alter table residents enable row level security;
alter table reminders enable row level security;
alter table birthdays enable row level security;
alter table emergency_contacts enable row level security;
alter table household_invites enable row level security; -- legado, sem uso no fluxo atual
alter table location_shares enable row level security;
alter table daily_messages enable row level security;
alter table activity_events enable row level security;
alter table household_members enable row level security;
alter table account_access enable row level security;
alter table family_connection_requests enable row level security;
alter table family_direct_messages enable row level security;
alter table password_recovery_requests enable row level security;
alter table household_join_requests enable row level security;

-- Remove todas as políticas existentes das tabelas controladas.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'households',
        'residents',
        'reminders',
        'birthdays',
        'emergency_contacts',
        'household_invites',
        'location_shares',
        'daily_messages',
        'activity_events',
        'household_members',
        'account_access',
        'family_connection_requests',
        'family_direct_messages',
        'password_recovery_requests',
        'household_join_requests'
      ])
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end
$$;

-- Casas: usuários autenticados podem localizar uma casa pelo código, mas isso
-- não concede acesso. Entrada e conexão continuam dependendo de aprovação.
-- O update sem membros permite finalizar o bootstrap do primeiro dono.
create policy households_authenticated_select
  on households for select to authenticated
  using (auth.uid() is not null);

create policy households_authenticated_insert
  on households for insert to authenticated
  with check (auth.uid() is not null);

create policy households_member_or_bootstrap_update
  on households for update to authenticated
  using (
    public.is_household_member(id)
    or not public.household_has_members(id)
  )
  with check (
    public.is_household_member(id)
    or not public.household_has_members(id)
  );

-- Perfis: membros da casa leem. Durante o bootstrap, o primeiro perfil pode
-- ser criado antes da associação owner existir.
create policy residents_member_select
  on residents for select to authenticated
  using (public.is_household_member(household_id));

create policy residents_member_or_bootstrap_insert
  on residents for insert to authenticated
  with check (
    (
      public.is_household_member(household_id)
      and (
        auth_user_id = auth.uid()
        or public.is_household_owner(household_id)
      )
    )
    or not public.household_has_members(household_id)
  );

create policy residents_self_or_owner_update
  on residents for update to authenticated
  using (
    public.is_resident_account(id)
    or public.is_household_owner(household_id)
    or (
      public.is_household_member(household_id)
      and auth_user_id is null
    )
  )
  with check (
    auth_user_id = auth.uid()
    or public.is_household_owner(household_id)
  );

create policy residents_owner_delete
  on residents for delete to authenticated
  using (public.is_household_owner(household_id));

-- Associação: o usuário lê as próprias casas. A única inserção pelo cliente
-- é o owner inicial de uma casa ainda sem membros. Novos membros entram
-- exclusivamente pela API após aprovação.
create policy household_members_self_select
  on household_members for select to authenticated
  using (user_id = auth.uid());

create policy household_members_owner_bootstrap_insert
  on household_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and not public.household_has_members(household_id)
  );

-- Conta: cada usuário acessa somente seu próprio ID/e-mail de recuperação.
create policy account_access_self_select
  on account_access for select to authenticated
  using (user_id = auth.uid());

create policy account_access_self_insert
  on account_access for insert to authenticated
  with check (user_id = auth.uid());

create policy account_access_self_update
  on account_access for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Lembretes: privados somente para a conta vinculada ao perfil autor.
create policy reminders_member_select
  on reminders for select to authenticated
  using (
    public.is_household_member(household_id)
    and (
      coalesce(visibility, 'household') = 'household'
      or public.is_resident_account(resident_id)
    )
  );

create policy reminders_member_insert
  on reminders for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and public.is_resident_account(resident_id)
  );

create policy reminders_author_update
  on reminders for update to authenticated
  using (public.is_resident_account(resident_id))
  with check (
    public.is_household_member(household_id)
    and public.is_resident_account(resident_id)
  );

create policy reminders_author_delete
  on reminders for delete to authenticated
  using (public.is_resident_account(resident_id));

-- Aniversários.
create policy birthdays_member_select
  on birthdays for select to authenticated
  using (
    public.is_household_member(household_id)
    and (
      coalesce(visibility, 'household') = 'household'
      or public.is_resident_account(resident_id)
      or public.is_resident_account(profile_resident_id)
    )
  );

create policy birthdays_member_insert
  on birthdays for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and (
      resident_id is null
      or public.is_resident_account(resident_id)
      or public.is_resident_account(profile_resident_id)
    )
  );

create policy birthdays_author_update
  on birthdays for update to authenticated
  using (
    public.is_resident_account(resident_id)
    or public.is_resident_account(profile_resident_id)
  )
  with check (public.is_household_member(household_id));

create policy birthdays_author_delete
  on birthdays for delete to authenticated
  using (
    public.is_resident_account(resident_id)
    or public.is_resident_account(profile_resident_id)
  );

-- Contatos de emergência: compartilhados entre membros.
create policy emergency_contacts_member_select
  on emergency_contacts for select to authenticated
  using (public.is_household_member(household_id));

create policy emergency_contacts_member_insert
  on emergency_contacts for insert to authenticated
  with check (public.is_household_member(household_id));

create policy emergency_contacts_member_update
  on emergency_contacts for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy emergency_contacts_member_delete
  on emergency_contacts for delete to authenticated
  using (public.is_household_member(household_id));

-- Localização.
create policy location_shares_member_select
  on location_shares for select to authenticated
  using (public.is_household_member(household_id));

create policy location_shares_author_insert
  on location_shares for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and public.is_resident_account(resident_id)
  );

create policy location_shares_author_delete
  on location_shares for delete to authenticated
  using (
    public.is_resident_account(resident_id)
    or public.is_household_owner(household_id)
  );

-- Mensagens do dia.
create policy daily_messages_member_select
  on daily_messages for select to authenticated
  using (public.is_household_member(household_id));

create policy daily_messages_author_insert
  on daily_messages for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and public.is_resident_account(resident_id)
  );

create policy daily_messages_author_update
  on daily_messages for update to authenticated
  using (public.is_resident_account(resident_id))
  with check (
    public.is_household_member(household_id)
    and public.is_resident_account(resident_id)
  );

create policy daily_messages_author_delete
  on daily_messages for delete to authenticated
  using (
    public.is_resident_account(resident_id)
    or public.is_household_owner(household_id)
  );

-- Timeline.
create policy activity_events_member_select
  on activity_events for select to authenticated
  using (public.is_household_member(household_id));

create policy activity_events_author_insert
  on activity_events for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and public.is_resident_account(resident_id)
  );

create policy activity_events_author_update
  on activity_events for update to authenticated
  using (public.is_resident_account(resident_id))
  with check (
    public.is_household_member(household_id)
    and public.is_resident_account(resident_id)
  );

create policy activity_events_author_delete
  on activity_events for delete to authenticated
  using (
    public.is_resident_account(resident_id)
    or public.is_household_owner(household_id)
  );

-- Conexão entre famílias: somente owners iniciam/respondem.
create policy family_connections_member_select
  on family_connection_requests for select to authenticated
  using (
    public.is_household_member(requester_household_id)
    or public.is_household_member(target_household_id)
  );

create policy family_connections_owner_insert
  on family_connection_requests for insert to authenticated
  with check (
    public.is_household_owner(requester_household_id)
    and public.is_resident_account(requested_by_resident_id)
  );

create policy family_connections_target_owner_update
  on family_connection_requests for update to authenticated
  using (public.is_household_owner(target_household_id))
  with check (public.is_household_owner(target_household_id));

create policy family_direct_messages_participant_select
  on family_direct_messages for select to authenticated
  using (
    public.is_resident_account(sender_resident_id)
    or public.is_resident_account(recipient_resident_id)
  );

create policy family_direct_messages_sender_insert
  on family_direct_messages for insert to authenticated
  with check (
    public.is_resident_account(sender_resident_id)
    and public.is_household_member(sender_household_id)
    and public.is_resident_in_household(
      sender_resident_id,
      sender_household_id
    )
    and (
      recipient_household_id = sender_household_id
      or public.is_household_connected(recipient_household_id)
    )
    and public.is_resident_in_household(
      recipient_resident_id,
      recipient_household_id
    )
  );

create policy family_direct_messages_recipient_update
  on family_direct_messages for update to authenticated
  using (public.is_resident_account(recipient_resident_id))
  with check (public.is_resident_account(recipient_resident_id));

-- Pedidos sensíveis: acesso somente pelas rotas com service role.
revoke all on household_invites from anon, authenticated;
revoke all on password_recovery_requests from anon, authenticated;
revoke all on household_join_requests from anon, authenticated;

-- Garante os privilégios necessários nas tabelas usadas pelo cliente.
grant select, insert, update on households to authenticated;
grant select, insert, update, delete on residents to authenticated;
grant select, insert, update, delete on reminders to authenticated;
grant select, insert, update, delete on birthdays to authenticated;
grant select, insert, update, delete on emergency_contacts to authenticated;
grant select, insert, update, delete on location_shares to authenticated;
grant select, insert, update, delete on daily_messages to authenticated;
grant select, insert, update, delete on activity_events to authenticated;
grant select, insert on household_members to authenticated;
grant select, insert, update on account_access to authenticated;
grant select, insert, update on family_connection_requests to authenticated;
grant select, insert, update on family_direct_messages to authenticated;

commit;

-- ============================================================
-- 6. STORAGE DOS STORIES
-- ============================================================

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'story-media',
  'story-media',
  true,
  5242880,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists story_media_member_select on storage.objects;
drop policy if exists story_media_member_insert on storage.objects;
drop policy if exists story_media_member_update on storage.objects;
drop policy if exists story_media_member_delete on storage.objects;
drop policy if exists "story media authenticated insert" on storage.objects;
drop policy if exists "story media authenticated update" on storage.objects;
drop policy if exists "story media authenticated delete" on storage.objects;

create policy story_media_member_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'story-media'
    and public.is_household_member((storage.foldername(name))[1]::uuid)
  );

create policy story_media_member_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'story-media'
    and public.is_household_member((storage.foldername(name))[1]::uuid)
  );

create policy story_media_member_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'story-media'
    and public.is_household_member((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'story-media'
    and public.is_household_member((storage.foldername(name))[1]::uuid)
  );

create policy story_media_member_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'story-media'
    and public.is_household_member((storage.foldername(name))[1]::uuid)
  );

-- ============================================================
-- 7. REALTIME
-- ============================================================

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
    'daily_messages',
    'activity_events',
    'household_members',
    'account_access',
    'family_connection_requests',
    'family_direct_messages',
    'password_recovery_requests',
    'household_join_requests'
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

-- Limpeza única de fotos antigas salvas diretamente como base64.
update daily_messages
set photo_url = null
where photo_url is not null
  and char_length(photo_url) > 900000;

-- ============================================================
-- 8. LIMPEZA AUTOMÁTICA DOS STORIES APÓS 24 HORAS
-- ============================================================

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.cleanup_expired_stories()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Apaga primeiro o evento da timeline para ele não continuar aparecendo
  -- depois que a mensagem vinculada vencer.
  delete from public.activity_events event
  using public.daily_messages message
  where event.message_id = message.id
    and message.expires_at <= now();

  delete from public.daily_messages
  where expires_at <= now();
end;
$$;

revoke all on function public.cleanup_expired_stories() from public, anon, authenticated;

-- Remove uma agenda antiga com o mesmo nome antes de recriá-la.
do $$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
  from cron.job
  where jobname = 'jtag-cleanup-expired-stories'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end
$$;

select cron.schedule(
  'jtag-cleanup-expired-stories',
  '*/15 * * * *',
  'select public.cleanup_expired_stories();'
);

-- Executa uma limpeza imediata ao instalar/atualizar este script.
select public.cleanup_expired_stories();

-- ============================================================
-- FIM
-- Variável obrigatória na Vercel:
-- SUPABASE_SERVICE_ROLE_KEY
-- ============================================================

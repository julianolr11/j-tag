-- J-tag account/family membership layer.
-- Run this after the original MVP tables exist.
-- It lets each Supabase Auth user have their own login while sharing access to
-- one or more households, Netflix-style.

create table if not exists household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists household_members_user_id_idx
on household_members(user_id);

alter table household_members enable row level security;

drop policy if exists "members can read own memberships" on household_members;
drop policy if exists "members can insert own memberships" on household_members;
drop policy if exists "members can update own memberships" on household_members;

create policy "members can read own memberships"
on household_members for select
to authenticated
using (user_id = auth.uid());

-- MVP invitation flow: an authenticated user can add themselves to a household.
-- Tighten this later by validating invitation tokens/codes server-side.
create policy "members can insert own memberships"
on household_members for insert
to authenticated
with check (user_id = auth.uid());

create policy "members can update own memberships"
on household_members for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

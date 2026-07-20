-- Execute uma vez no SQL Editor do Supabase.
-- Ter o código da casa cria apenas uma solicitação; o acesso depende do owner.

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

alter table household_join_requests enable row level security;
revoke all on household_join_requests from anon, authenticated;

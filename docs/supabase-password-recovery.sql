-- Execute uma vez no SQL Editor do Supabase.
-- Os códigos são guardados somente como hash e expiram após 15 minutos.

create table if not exists password_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'completed', 'cancelled')),
  code_hash text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists password_recovery_requests_target_idx
on password_recovery_requests (target_user_id, status, created_at desc);

create index if not exists password_recovery_requests_household_idx
on password_recovery_requests (household_id, status, created_at desc);

alter table password_recovery_requests enable row level security;

-- O acesso à tabela acontece apenas pelas rotas do servidor, que validam o dono
-- da casa antes de listar ou aprovar qualquer pedido.
revoke all on password_recovery_requests from anon, authenticated;

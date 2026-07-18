-- Execute uma vez no SQL Editor do Supabase.
-- Itens existentes continuam públicos por padrão.

alter table reminders
add column if not exists visibility text not null default 'household';

alter table reminders
drop constraint if exists reminders_visibility_check;

alter table reminders
add constraint reminders_visibility_check
check (visibility in ('private', 'household'));

alter table birthdays
add column if not exists resident_id uuid
references residents(id)
on delete set null;

alter table birthdays
add column if not exists visibility text not null default 'household';

alter table birthdays
drop constraint if exists birthdays_visibility_check;

alter table birthdays
add constraint birthdays_visibility_check
check (visibility in ('private', 'household'));

create index if not exists birthdays_resident_id_idx
on birthdays (resident_id);


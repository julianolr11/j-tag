-- Execute uma vez no SQL Editor do Supabase para persistir a recorrência.
alter table reminders
add column if not exists recurrence text;

alter table reminders
drop constraint if exists reminders_recurrence_check;

alter table reminders
add constraint reminders_recurrence_check
check (
  recurrence is null
  or recurrence in ('daily', 'weekly', 'monthly', 'yearly')
);

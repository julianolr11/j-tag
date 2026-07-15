-- MVP policies for the current J-tag prototype.
-- This keeps the app working with the public publishable key while the product
-- still uses resident PINs instead of Supabase Auth accounts.
--
-- Before production with real family data, replace these policies with
-- auth.uid()-based household membership policies.

drop policy if exists "mvp households read" on households;
drop policy if exists "mvp households insert" on households;
drop policy if exists "mvp households update" on households;
drop policy if exists "mvp residents read" on residents;
drop policy if exists "mvp residents insert" on residents;
drop policy if exists "mvp residents update" on residents;
drop policy if exists "mvp residents delete" on residents;
drop policy if exists "mvp reminders all" on reminders;
drop policy if exists "mvp birthdays all" on birthdays;
drop policy if exists "mvp emergency contacts all" on emergency_contacts;
drop policy if exists "mvp household invites all" on household_invites;

create policy "mvp households read"
on households for select
to anon, authenticated
using (true);

create policy "mvp households insert"
on households for insert
to anon, authenticated
with check (true);

create policy "mvp households update"
on households for update
to anon, authenticated
using (true)
with check (true);

create policy "mvp residents read"
on residents for select
to anon, authenticated
using (true);

create policy "mvp residents insert"
on residents for insert
to anon, authenticated
with check (true);

create policy "mvp residents update"
on residents for update
to anon, authenticated
using (true)
with check (true);

create policy "mvp residents delete"
on residents for delete
to anon, authenticated
using (true);

create policy "mvp reminders all"
on reminders for all
to anon, authenticated
using (true)
with check (true);

create policy "mvp birthdays all"
on birthdays for all
to anon, authenticated
using (true)
with check (true);

create policy "mvp emergency contacts all"
on emergency_contacts for all
to anon, authenticated
using (true)
with check (true);

create policy "mvp household invites all"
on household_invites for all
to anon, authenticated
using (true)
with check (true);

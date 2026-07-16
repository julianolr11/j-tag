alter table residents
add column if not exists theme text not null default 'default';

alter table residents
drop constraint if exists residents_theme_check;

alter table residents
add constraint residents_theme_check
check (theme in ('default', 'blue-light', 'aurora', 'green-home', 'graphite'));

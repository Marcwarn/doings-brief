alter table public.discovery_templates
add column if not exists audience_mode text not null default 'shared';

alter table public.discovery_templates
drop constraint if exists discovery_templates_audience_mode_check;

alter table public.discovery_templates
add constraint discovery_templates_audience_mode_check
check (audience_mode in ('shared', 'leaders', 'mixed'));

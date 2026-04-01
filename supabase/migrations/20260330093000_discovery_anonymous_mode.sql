alter table public.discovery_sessions
  add column if not exists response_mode text not null default 'named'
  check (response_mode in ('named', 'anonymous'));

create table if not exists public.discovery_submission_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.discovery_sessions(id) on delete cascade,
  respondent_label text,
  respondent_email text,
  demographic_role text,
  demographic_team text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz not null default now()
);

create index if not exists discovery_submission_entries_session_id_idx
  on public.discovery_submission_entries (session_id);

create index if not exists discovery_submission_entries_submitted_at_idx
  on public.discovery_submission_entries (submitted_at desc);

alter table public.discovery_submission_entries enable row level security;

create policy "discovery_submission_entries_select_own"
  on public.discovery_submission_entries
  for select
  using (
    exists (
      select 1
      from public.discovery_sessions s
      where s.id = session_id
        and s.consultant_id = auth.uid()
    )
  );

create policy "discovery_submission_entries_insert_own"
  on public.discovery_submission_entries
  for insert
  with check (
    exists (
      select 1
      from public.discovery_sessions s
      where s.id = session_id
        and s.consultant_id = auth.uid()
    )
  );

create policy "discovery_submission_entries_update_own"
  on public.discovery_submission_entries
  for update
  using (
    exists (
      select 1
      from public.discovery_sessions s
      where s.id = session_id
        and s.consultant_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.discovery_sessions s
      where s.id = session_id
        and s.consultant_id = auth.uid()
    )
  );

create policy "discovery_submission_entries_delete_own"
  on public.discovery_submission_entries
  for delete
  using (
    exists (
      select 1
      from public.discovery_sessions s
      where s.id = session_id
        and s.consultant_id = auth.uid()
    )
  );

alter table public.discovery_responses
  add column if not exists submission_entry_id uuid references public.discovery_submission_entries(id) on delete cascade;

insert into public.discovery_submission_entries (
  session_id,
  respondent_label,
  respondent_email,
  created_at,
  submitted_at
)
select
  s.id,
  s.client_name,
  s.client_email,
  coalesce(s.submitted_at, s.created_at),
  coalesce(s.submitted_at, s.created_at)
from public.discovery_sessions s
where exists (
  select 1
  from public.discovery_responses r
  where r.session_id = s.id
)
and not exists (
  select 1
  from public.discovery_submission_entries e
  where e.session_id = s.id
);

update public.discovery_responses r
set submission_entry_id = e.id
from public.discovery_submission_entries e
where e.session_id = r.session_id
  and r.submission_entry_id is null;

alter table public.discovery_responses
  alter column submission_entry_id set not null;

alter table public.discovery_responses
  drop constraint if exists discovery_responses_session_id_question_id_key;

alter table public.discovery_responses
  add constraint discovery_responses_submission_entry_id_question_id_key
  unique (submission_entry_id, question_id);

create index if not exists discovery_responses_submission_entry_id_idx
  on public.discovery_responses (submission_entry_id);

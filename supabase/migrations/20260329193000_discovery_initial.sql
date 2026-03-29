create table if not exists public.discovery_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  intro_title text not null,
  intro_text text not null,
  status text not null default 'draft' check (status in ('draft', 'active')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.discovery_templates(id) on delete cascade,
  label text not null,
  description text not null,
  order_index integer not null,
  created_at timestamptz not null default now(),
  unique (template_id, order_index)
);

create table if not exists public.discovery_questions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.discovery_sections(id) on delete cascade,
  type text not null check (type in ('open', 'choice', 'scale')),
  text text not null,
  order_index integer not null,
  max_choices integer,
  scale_min integer,
  scale_max integer,
  scale_min_label text,
  scale_max_label text,
  created_at timestamptz not null default now(),
  unique (section_id, order_index),
  constraint discovery_questions_choice_max_choices_check
    check (
      type <> 'choice'
      or max_choices is null
      or max_choices >= 1
    ),
  constraint discovery_questions_scale_bounds_check
    check (
      type <> 'scale'
      or (
        scale_min is not null
        and scale_max is not null
        and scale_max >= scale_min
      )
    )
);

create table if not exists public.discovery_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.discovery_questions(id) on delete cascade,
  label text not null,
  order_index integer not null,
  unique (question_id, order_index)
);

create table if not exists public.discovery_sessions (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references auth.users(id) on delete cascade,
  consultant_email text,
  template_id uuid not null references public.discovery_templates(id) on delete restrict,
  client_name text not null,
  client_email text not null,
  client_organisation text,
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'submitted')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

create table if not exists public.discovery_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.discovery_sessions(id) on delete cascade,
  question_id uuid not null references public.discovery_questions(id) on delete restrict,
  response_type text not null check (response_type in ('open', 'choice', 'scale')),
  text_value text,
  scale_value integer,
  created_at timestamptz not null default now(),
  unique (session_id, question_id),
  constraint discovery_responses_scale_value_check
    check (
      response_type <> 'scale'
      or scale_value is not null
    )
);

create table if not exists public.discovery_response_options (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.discovery_responses(id) on delete cascade,
  option_label text not null
);

create index if not exists discovery_templates_user_id_idx
  on public.discovery_templates (user_id);

create index if not exists discovery_sections_template_id_idx
  on public.discovery_sections (template_id);

create index if not exists discovery_questions_section_id_idx
  on public.discovery_questions (section_id);

create index if not exists discovery_question_options_question_id_idx
  on public.discovery_question_options (question_id);

create index if not exists discovery_sessions_consultant_id_idx
  on public.discovery_sessions (consultant_id);

create index if not exists discovery_sessions_template_id_idx
  on public.discovery_sessions (template_id);

create index if not exists discovery_sessions_status_idx
  on public.discovery_sessions (status);

create index if not exists discovery_responses_session_id_idx
  on public.discovery_responses (session_id);

create index if not exists discovery_responses_question_id_idx
  on public.discovery_responses (question_id);

create index if not exists discovery_response_options_response_id_idx
  on public.discovery_response_options (response_id);

alter table public.discovery_templates enable row level security;
alter table public.discovery_sections enable row level security;
alter table public.discovery_questions enable row level security;
alter table public.discovery_question_options enable row level security;
alter table public.discovery_sessions enable row level security;
alter table public.discovery_responses enable row level security;
alter table public.discovery_response_options enable row level security;

create policy "discovery_templates_select_own"
  on public.discovery_templates
  for select
  using (auth.uid() = user_id);

create policy "discovery_templates_insert_own"
  on public.discovery_templates
  for insert
  with check (auth.uid() = user_id);

create policy "discovery_templates_update_own"
  on public.discovery_templates
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "discovery_templates_delete_own"
  on public.discovery_templates
  for delete
  using (auth.uid() = user_id);

create policy "discovery_sections_select_own"
  on public.discovery_sections
  for select
  using (
    exists (
      select 1
      from public.discovery_templates t
      where t.id = template_id
        and t.user_id = auth.uid()
    )
  );

create policy "discovery_sections_insert_own"
  on public.discovery_sections
  for insert
  with check (
    exists (
      select 1
      from public.discovery_templates t
      where t.id = template_id
        and t.user_id = auth.uid()
    )
  );

create policy "discovery_sections_update_own"
  on public.discovery_sections
  for update
  using (
    exists (
      select 1
      from public.discovery_templates t
      where t.id = template_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.discovery_templates t
      where t.id = template_id
        and t.user_id = auth.uid()
    )
  );

create policy "discovery_sections_delete_own"
  on public.discovery_sections
  for delete
  using (
    exists (
      select 1
      from public.discovery_templates t
      where t.id = template_id
        and t.user_id = auth.uid()
    )
  );

create policy "discovery_questions_select_own"
  on public.discovery_questions
  for select
  using (
    exists (
      select 1
      from public.discovery_sections s
      join public.discovery_templates t on t.id = s.template_id
      where s.id = section_id
        and t.user_id = auth.uid()
    )
  );

create policy "discovery_questions_insert_own"
  on public.discovery_questions
  for insert
  with check (
    exists (
      select 1
      from public.discovery_sections s
      join public.discovery_templates t on t.id = s.template_id
      where s.id = section_id
        and t.user_id = auth.uid()
    )
  );

create policy "discovery_questions_update_own"
  on public.discovery_questions
  for update
  using (
    exists (
      select 1
      from public.discovery_sections s
      join public.discovery_templates t on t.id = s.template_id
      where s.id = section_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.discovery_sections s
      join public.discovery_templates t on t.id = s.template_id
      where s.id = section_id
        and t.user_id = auth.uid()
    )
  );

create policy "discovery_questions_delete_own"
  on public.discovery_questions
  for delete
  using (
    exists (
      select 1
      from public.discovery_sections s
      join public.discovery_templates t on t.id = s.template_id
      where s.id = section_id
        and t.user_id = auth.uid()
    )
  );

create policy "discovery_question_options_select_own"
  on public.discovery_question_options
  for select
  using (
    exists (
      select 1
      from public.discovery_questions q
      join public.discovery_sections s on s.id = q.section_id
      join public.discovery_templates t on t.id = s.template_id
      where q.id = question_id
        and t.user_id = auth.uid()
    )
  );

create policy "discovery_question_options_insert_own"
  on public.discovery_question_options
  for insert
  with check (
    exists (
      select 1
      from public.discovery_questions q
      join public.discovery_sections s on s.id = q.section_id
      join public.discovery_templates t on t.id = s.template_id
      where q.id = question_id
        and t.user_id = auth.uid()
    )
  );

create policy "discovery_question_options_update_own"
  on public.discovery_question_options
  for update
  using (
    exists (
      select 1
      from public.discovery_questions q
      join public.discovery_sections s on s.id = q.section_id
      join public.discovery_templates t on t.id = s.template_id
      where q.id = question_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.discovery_questions q
      join public.discovery_sections s on s.id = q.section_id
      join public.discovery_templates t on t.id = s.template_id
      where q.id = question_id
        and t.user_id = auth.uid()
    )
  );

create policy "discovery_question_options_delete_own"
  on public.discovery_question_options
  for delete
  using (
    exists (
      select 1
      from public.discovery_questions q
      join public.discovery_sections s on s.id = q.section_id
      join public.discovery_templates t on t.id = s.template_id
      where q.id = question_id
        and t.user_id = auth.uid()
    )
  );

create policy "discovery_sessions_select_own"
  on public.discovery_sessions
  for select
  using (auth.uid() = consultant_id);

create policy "discovery_sessions_insert_own"
  on public.discovery_sessions
  for insert
  with check (auth.uid() = consultant_id);

create policy "discovery_sessions_update_own"
  on public.discovery_sessions
  for update
  using (auth.uid() = consultant_id)
  with check (auth.uid() = consultant_id);

create policy "discovery_sessions_delete_own"
  on public.discovery_sessions
  for delete
  using (auth.uid() = consultant_id);

create policy "discovery_responses_select_own"
  on public.discovery_responses
  for select
  using (
    exists (
      select 1
      from public.discovery_sessions s
      where s.id = session_id
        and s.consultant_id = auth.uid()
    )
  );

create policy "discovery_responses_insert_own"
  on public.discovery_responses
  for insert
  with check (
    exists (
      select 1
      from public.discovery_sessions s
      where s.id = session_id
        and s.consultant_id = auth.uid()
    )
  );

create policy "discovery_responses_update_own"
  on public.discovery_responses
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

create policy "discovery_responses_delete_own"
  on public.discovery_responses
  for delete
  using (
    exists (
      select 1
      from public.discovery_sessions s
      where s.id = session_id
        and s.consultant_id = auth.uid()
    )
  );

create policy "discovery_response_options_select_own"
  on public.discovery_response_options
  for select
  using (
    exists (
      select 1
      from public.discovery_responses r
      join public.discovery_sessions s on s.id = r.session_id
      where r.id = response_id
        and s.consultant_id = auth.uid()
    )
  );

create policy "discovery_response_options_insert_own"
  on public.discovery_response_options
  for insert
  with check (
    exists (
      select 1
      from public.discovery_responses r
      join public.discovery_sessions s on s.id = r.session_id
      where r.id = response_id
        and s.consultant_id = auth.uid()
    )
  );

create policy "discovery_response_options_update_own"
  on public.discovery_response_options
  for update
  using (
    exists (
      select 1
      from public.discovery_responses r
      join public.discovery_sessions s on s.id = r.session_id
      where r.id = response_id
        and s.consultant_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.discovery_responses r
      join public.discovery_sessions s on s.id = r.session_id
      where r.id = response_id
        and s.consultant_id = auth.uid()
    )
  );

create policy "discovery_response_options_delete_own"
  on public.discovery_response_options
  for delete
  using (
    exists (
      select 1
      from public.discovery_responses r
      join public.discovery_sessions s on s.id = r.session_id
      where r.id = response_id
        and s.consultant_id = auth.uid()
    )
  );

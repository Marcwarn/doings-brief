-- Loops: post-delivery follow-up email sequences
-- Konsulten skapar en mailsekvens efter leverans, AI genererar innehållet,
-- konsulten skickar manuellt steg för steg.

create table if not exists public.loops (
  id                  uuid        primary key default gen_random_uuid(),
  user_id             uuid        not null references auth.users(id) on delete cascade,
  title               text        not null,
  topic_description   text        not null default '',
  context_notes       text        not null default '',
  linked_dispatch_id  text        null,
  token               uuid        not null unique default gen_random_uuid(),
  status              text        not null default 'draft'
                                  check (status in ('draft', 'active', 'paused', 'completed')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.loop_messages (
  id          uuid        primary key default gen_random_uuid(),
  loop_id     uuid        not null references public.loops(id) on delete cascade,
  order_index int         not null,
  subject     text        not null default '',
  body_html   text        not null default '',
  body_text   text        not null default '',
  status      text        not null default 'draft'
                          check (status in ('draft', 'approved')),
  sent_at     timestamptz null,
  created_at  timestamptz not null default now(),
  unique (loop_id, order_index)
);

create table if not exists public.loop_recipients (
  id         uuid        primary key default gen_random_uuid(),
  loop_id    uuid        not null references public.loops(id) on delete cascade,
  name       text        not null default '',
  email      text        not null,
  source     text        null check (source in ('brief', 'manual', null)),
  created_at timestamptz not null default now(),
  unique (loop_id, email)
);

create table if not exists public.loop_sends (
  id           uuid        primary key default gen_random_uuid(),
  loop_id      uuid        not null references public.loops(id) on delete cascade,
  message_id   uuid        not null references public.loop_messages(id) on delete cascade,
  recipient_id uuid        not null references public.loop_recipients(id) on delete cascade,
  sent_at      timestamptz null,
  status       text        not null default 'pending'
                           check (status in ('pending', 'sent', 'failed')),
  created_at   timestamptz not null default now(),
  unique (message_id, recipient_id)
);

-- Indexes
create index if not exists loops_user_id_idx         on public.loops (user_id);
create index if not exists loops_status_idx          on public.loops (status);
create index if not exists loop_messages_loop_id_idx on public.loop_messages (loop_id);
create index if not exists loop_recipients_loop_id_idx on public.loop_recipients (loop_id);
create index if not exists loop_sends_loop_id_idx    on public.loop_sends (loop_id);
create index if not exists loop_sends_status_idx     on public.loop_sends (status) where status = 'pending';

-- RLS
alter table public.loops           enable row level security;
alter table public.loop_messages   enable row level security;
alter table public.loop_recipients enable row level security;
alter table public.loop_sends      enable row level security;

-- loops: consultant owns their own loops
create policy "loops_select_own" on public.loops
  for select using (auth.uid() = user_id);
create policy "loops_insert_own" on public.loops
  for insert with check (auth.uid() = user_id);
create policy "loops_update_own" on public.loops
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "loops_delete_own" on public.loops
  for delete using (auth.uid() = user_id);

-- loop_messages: access via parent loop ownership
create policy "loop_messages_select_own" on public.loop_messages
  for select using (
    exists (select 1 from public.loops l where l.id = loop_id and l.user_id = auth.uid())
  );
create policy "loop_messages_insert_own" on public.loop_messages
  for insert with check (
    exists (select 1 from public.loops l where l.id = loop_id and l.user_id = auth.uid())
  );
create policy "loop_messages_update_own" on public.loop_messages
  for update using (
    exists (select 1 from public.loops l where l.id = loop_id and l.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.loops l where l.id = loop_id and l.user_id = auth.uid())
  );
create policy "loop_messages_delete_own" on public.loop_messages
  for delete using (
    exists (select 1 from public.loops l where l.id = loop_id and l.user_id = auth.uid())
  );

-- loop_recipients: access via parent loop ownership
create policy "loop_recipients_select_own" on public.loop_recipients
  for select using (
    exists (select 1 from public.loops l where l.id = loop_id and l.user_id = auth.uid())
  );
create policy "loop_recipients_insert_own" on public.loop_recipients
  for insert with check (
    exists (select 1 from public.loops l where l.id = loop_id and l.user_id = auth.uid())
  );
create policy "loop_recipients_update_own" on public.loop_recipients
  for update using (
    exists (select 1 from public.loops l where l.id = loop_id and l.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.loops l where l.id = loop_id and l.user_id = auth.uid())
  );
create policy "loop_recipients_delete_own" on public.loop_recipients
  for delete using (
    exists (select 1 from public.loops l where l.id = loop_id and l.user_id = auth.uid())
  );

-- loop_sends: access via parent loop ownership
create policy "loop_sends_select_own" on public.loop_sends
  for select using (
    exists (select 1 from public.loops l where l.id = loop_id and l.user_id = auth.uid())
  );
create policy "loop_sends_insert_own" on public.loop_sends
  for insert with check (
    exists (select 1 from public.loops l where l.id = loop_id and l.user_id = auth.uid())
  );
create policy "loop_sends_update_own" on public.loop_sends
  for update using (
    exists (select 1 from public.loops l where l.id = loop_id and l.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.loops l where l.id = loop_id and l.user_id = auth.uid())
  );
create policy "loop_sends_delete_own" on public.loop_sends
  for delete using (
    exists (select 1 from public.loops l where l.id = loop_id and l.user_id = auth.uid())
  );

-- Correo (Gmail → Nebula). El permiso renovable de Gmail vive solo en el servidor, como el de
-- Google Calendar: lo lee y escribe la función gmail-triage con la clave de servicio.
create table public.gmail_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  refresh_token text not null check (char_length(refresh_token) between 10 and 2048),
  updated_at timestamptz not null default now()
);
alter table public.gmail_tokens enable row level security;
revoke all on public.gmail_tokens from anon, authenticated;

-- Clasificación de cada correo revisado. La escribe el servidor; la persona solo la lee, decide
-- (crear tarea, hecho, descartar) y puede borrarla. Del correo se guarda remitente y asunto,
-- nunca el cuerpo.
create table public.mail_triage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id text not null check (message_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  thread_id text not null check (thread_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  sender text not null check (char_length(sender) <= 200),
  subject text not null check (char_length(subject) <= 300),
  received_at timestamptz not null,
  kind text not null check (kind in ('todo', 'waiting', 'info', 'ignore')),
  title text check (char_length(title) between 1 and 160),
  due_date date,
  priority smallint not null default 2 check (priority between 1 and 3),
  reason text check (char_length(reason) <= 200),
  status text not null default 'new' check (status in ('new', 'task', 'done', 'dismissed')),
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, message_id)
);
create index mail_triage_recent on public.mail_triage (user_id, received_at desc);
alter table public.mail_triage enable row level security;

create policy mail_triage_read on public.mail_triage for select to authenticated
  using (user_id = (select auth.uid()));
create policy mail_triage_decide on public.mail_triage for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (task_id is null or exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid())))
  );
create policy mail_triage_delete on public.mail_triage for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.mail_triage from anon, authenticated;
grant select, delete on public.mail_triage to authenticated;
grant update (status, task_id) on public.mail_triage to authenticated;

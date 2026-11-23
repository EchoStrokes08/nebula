-- Outlook (Microsoft Graph) además de Gmail. El permiso renovable de Microsoft vive solo en el
-- servidor; la conexión vuelve a la función outlook-mail, que reconoce a la persona por un estado
-- de un solo uso creado al empezar (así la cuenta de Outlook puede ser distinta de la de Nebula).
create table public.outlook_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  refresh_token text not null check (char_length(refresh_token) between 10 and 8192),
  updated_at timestamptz not null default now()
);
alter table public.outlook_tokens enable row level security;
revoke all on public.outlook_tokens from anon, authenticated;

create table public.mail_oauth_states (
  state text primary key check (state ~ '^[A-Za-z0-9_-]{32,128}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target text not null check (target in ('w', 'a', 'd')),
  created_at timestamptz not null default now()
);
alter table public.mail_oauth_states enable row level security;
revoke all on public.mail_oauth_states from anon, authenticated;

-- Las sugerencias llevan su proveedor. Los ids de Outlook son largos y admiten + / =.
alter table public.mail_triage add column provider text not null default 'gmail' check (provider in ('gmail', 'outlook'));
alter table public.mail_triage add column web_link text check (
  char_length(web_link) <= 4096 and web_link ~ '^https://(outlook\.(live|office|office365)\.com|[a-z0-9-]+\.outlook\.com)/'
);
alter table public.mail_triage drop constraint mail_triage_message_id_check;
alter table public.mail_triage drop constraint mail_triage_thread_id_check;
alter table public.mail_triage add constraint mail_triage_message_id_check check (char_length(message_id) between 1 and 512 and message_id ~ '^[A-Za-z0-9+/=_-]+$');
alter table public.mail_triage add constraint mail_triage_thread_id_check check (char_length(thread_id) between 1 and 512 and thread_id ~ '^[A-Za-z0-9+/=_-]+$');
alter table public.mail_triage drop constraint mail_triage_pkey;
alter table public.mail_triage add primary key (user_id, provider, message_id);

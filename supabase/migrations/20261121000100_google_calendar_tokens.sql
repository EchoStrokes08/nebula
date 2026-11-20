-- Permiso renovable de Google Calendar: el refresh token vive solo en el servidor. Lo lee y escribe
-- la función google-calendar con la clave de servicio; los clientes nunca tienen acceso directo.
create table public.google_calendar_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  refresh_token text not null check (char_length(refresh_token) between 10 and 2048),
  updated_at timestamptz not null default now()
);
alter table public.google_calendar_tokens enable row level security;
-- Sin políticas: ni anon ni authenticated pueden leerla.
revoke all on public.google_calendar_tokens from anon, authenticated;

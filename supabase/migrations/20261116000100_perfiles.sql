-- Nebula · F01-009 — Perfiles y preferencias
-- Cada usuario de Supabase Auth tiene exactamente un perfil y una fila de preferencias,
-- creados por trigger en el alta. El email nunca se copia a tablas públicas.

create type public.profile_visibility as enum ('private', 'friends', 'public');
create type public.motivation_intensity as enum ('balanced', 'demanding', 'intense');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null,
  display_name text not null,
  avatar_path text,
  timezone text not null default 'UTC',
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  visibility public.profile_visibility not null default 'friends',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_handle_format check (handle ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 60),
  constraint profiles_timezone_length check (char_length(timezone) between 1 and 64)
);
create unique index profiles_handle_key on public.profiles (handle);

create table public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  interests text[] not null default '{}',
  active_days smallint[] not null default '{1,2,3,4,5}',
  focus_windows jsonb not null default '[]'::jsonb,
  motivation_intensity public.motivation_intensity not null default 'balanced',
  notifications jsonb not null default '{"habits":true,"tasks":true,"events":true,"social":true,"weekly_summary":true}'::jsonb,
  quiet_hours_start time,
  quiet_hours_end time,
  max_notifications_per_day smallint not null default 8 check (max_notifications_per_day between 0 and 50),
  ai_enabled boolean not null default true,
  weekly_review_day smallint check (weekly_review_day between 0 and 6),
  onboarding_completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint user_preferences_active_days check (active_days <@ '{0,1,2,3,4,5,6}'::smallint[])
);

-- updated_at automático
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger user_preferences_touch before update on public.user_preferences
  for each row execute function public.touch_updated_at();

-- Alta: crea perfil y preferencias. El handle se toma de los metadatos si es válido y libre;
-- si no, se genera uno aleatorio que el usuario podrá cambiar.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  wanted text := lower(coalesce(new.raw_user_meta_data ->> 'handle', ''));
  final_handle text;
  name text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
begin
  if wanted ~ '^[a-z0-9_]{3,24}$'
     and not exists (select 1 from public.profiles p where p.handle = wanted) then
    final_handle := wanted;
  else
    loop
      final_handle := 'usuario_' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
      exit when not exists (select 1 from public.profiles p where p.handle = final_handle);
    end loop;
  end if;
  if name = '' then name := final_handle; end if;

  insert into public.profiles (id, handle, display_name, timezone)
  values (new.id, final_handle, left(name, 60), coalesce(nullif(new.raw_user_meta_data ->> 'timezone', ''), 'UTC'));
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: cada usuario solo ve y edita lo suyo. La lectura de perfiles ajenos se habilita en F08
-- mediante una función que respeta amistades, bloqueos y visibilidad.
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy prefs_select_own on public.user_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy prefs_update_own on public.user_preferences
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Inserciones y borrados solo por trigger / cascada desde auth.users.
revoke insert, delete on public.profiles, public.user_preferences from anon, authenticated;
revoke all on public.profiles, public.user_preferences from anon;

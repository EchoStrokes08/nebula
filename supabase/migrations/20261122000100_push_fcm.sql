-- Avisos push (Firebase Cloud Messaging) para las notificaciones sociales con la app cerrada.
-- Los tokens solo se escriben por RPC y solo los lee la función push-dispatch (clave de servicio).
create table public.push_tokens (
  token text primary key check (char_length(token) between 20 and 4096),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null default 'android' check (platform in ('android')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
-- Sin políticas: ni anon ni authenticated leen ni escriben la tabla directamente.
revoke all on public.push_tokens from anon, authenticated;

-- Un dispositivo pertenece a la última cuenta que inició sesión en él.
create or replace function public.register_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.push_tokens (token, user_id) values (p_token, auth.uid())
  on conflict (token) do update set user_id = excluded.user_id, updated_at = now();
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
end;
$$;

revoke all on function public.register_push_token(text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- Cada notificación nueva avisa a push-dispatch (pg_net, asíncrono: no retrasa ni bloquea el insert).
-- La URL y el secreto viven en Vault, no en el repositorio:
--   select vault.create_secret('<PUSH_DISPATCH_SECRET>', 'nebula_push_secret');
-- (`nebula_project_url` ya existe, ver `salud_modelos_ia`). Sin pg_net ni Vault no hace nada.
create or replace function public.notify_push_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null
     or to_regclass('vault.decrypted_secrets') is null then
    return new;
  end if;
  if not exists (select 1 from public.push_tokens where user_id = new.user_id) then return new; end if;
  execute $q$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'nebula_project_url') || '/functions/v1/push-dispatch',
      body := jsonb_build_object('notification_id', $1),
      params := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'nebula_push_secret')),
      timeout_milliseconds := 10000)
  $q$ using new.id;
  return new;
exception when others then
  -- Un fallo del aviso nunca impide guardar la notificación.
  raise warning 'push-dispatch no disponible: %', sqlerrm;
  return new;
end;
$$;
revoke all on function public.notify_push_dispatch() from public, anon, authenticated;

create trigger notifications_push
after insert on public.notifications
for each row execute function public.notify_push_dispatch();

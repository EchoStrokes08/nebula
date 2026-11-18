-- Salud de los modelos de IA: contadores del uso real de la ventana actual y la última evaluación
-- (cada 6 h, función ai-health). Solo el servidor (rol de servicio) la lee y la escribe.
create table public.ai_model_health (
  model text primary key check (length(model) between 3 and 200),
  ok_count integer not null default 0,
  busy_count integer not null default 0,
  error_count integer not null default 0,
  ms_total bigint not null default 0,
  window_start timestamptz not null default now(),
  last_used_at timestamptz,
  available boolean,
  success_rate real check (success_rate between 0 and 1),
  latency_ms integer,
  source text check (source in ('uso', 'sondeo')),
  note text check (length(note) <= 300),
  checked_at timestamptz
);
alter table public.ai_model_health enable row level security;
revoke all on public.ai_model_health from anon, authenticated;

-- Suma un intento real (lo llama ai-assist tras cada modelo probado).
create function public.record_ai_attempt(p_model text, p_outcome text, p_ms integer) returns void
language sql security definer set search_path = '' as $$
  insert into public.ai_model_health as h (model, ok_count, busy_count, error_count, ms_total, last_used_at)
  values (p_model, (p_outcome = 'ok')::int, (p_outcome = 'busy')::int, (p_outcome = 'error')::int,
          case when p_outcome = 'ok' then greatest(p_ms, 0) else 0 end, now())
  on conflict (model) do update set
    ok_count = h.ok_count + excluded.ok_count,
    busy_count = h.busy_count + excluded.busy_count,
    error_count = h.error_count + excluded.error_count,
    ms_total = h.ms_total + excluded.ms_total,
    last_used_at = now();
$$;
revoke all on function public.record_ai_attempt(text, text, integer) from public, anon, authenticated;
grant execute on function public.record_ai_attempt(text, text, integer) to service_role;

-- Revisión cada 6 horas. La URL del proyecto y el secreto viven en Vault (no en el repositorio):
--   select vault.create_secret('https://<ref>.supabase.co', 'nebula_project_url');
--   select vault.create_secret('<AI_HEALTH_SECRET>', 'nebula_ai_health_secret');
-- Si pg_cron/pg_net no están (pruebas locales), ai-assist sigue aprendiendo del uso real.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net with schema extensions;
    perform cron.schedule('nebula-ai-health', '7 */6 * * *', $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'nebula_project_url') || '/functions/v1/ai-health',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-health-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'nebula_ai_health_secret')),
        body := '{}'::jsonb,
        timeout_milliseconds := 150000);
    $cron$);
  end if;
exception when others then
  raise notice 'pg_cron/pg_net no disponibles: sin revisión programada (%).', sqlerrm;
end;
$$;

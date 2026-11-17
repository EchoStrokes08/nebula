-- Diario privado y revisión semanal. No se incluye en el contexto de IA.
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  day_key date not null,
  kind text not null default 'daily' check (kind in ('daily', 'weekly')),
  achievements text not null default '' check (char_length(achievements) <= 5000),
  difficulties text not null default '' check (char_length(difficulties) <= 5000),
  learnings text not null default '' check (char_length(learnings) <= 5000),
  next_step text not null default '' check (char_length(next_step) <= 5000),
  goal_id uuid references public.goals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, day_key, kind)
);
alter table public.journal_entries enable row level security;
create policy journal_own on public.journal_entries for all to authenticated
  using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid()) and (goal_id is null or exists (select 1 from public.goals g where g.id = goal_id and g.user_id = (select auth.uid())))
  );
revoke all on public.journal_entries from anon;
create trigger journal_touch before update on public.journal_entries for each row execute function public.touch_updated_at();

-- Contador atómico compartido por todos los workers; no editable desde clientes.
create table public.ai_daily_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null default current_date,
  requests integer not null default 0 check (requests between 0 and 20),
  primary key(user_id, day)
);
alter table public.ai_daily_usage enable row level security;
revoke all on public.ai_daily_usage from public, anon, authenticated;
create function public.consume_ai_request() returns boolean
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); n integer;
begin
  if me is null then raise exception 'no autenticado'; end if;
  if not exists (select 1 from public.user_preferences where user_id = me and ai_enabled) then raise exception 'IA desactivada'; end if;
  insert into public.ai_daily_usage(user_id, day, requests) values (me, current_date, 1)
  on conflict(user_id, day) do update set requests = public.ai_daily_usage.requests + 1
  where public.ai_daily_usage.requests < 20 returning requests into n;
  return n is not null;
end;
$$;
revoke all on function public.consume_ai_request() from public, anon;
grant execute on function public.consume_ai_request() to authenticated;

-- Privacidad por defecto para cuentas nuevas; las elecciones existentes se conservan.
alter table public.profiles alter column visibility set default 'private';
alter table public.user_preferences alter column ai_enabled set default false;

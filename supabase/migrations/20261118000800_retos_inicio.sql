-- Retos que empiezan hoy: se activan en cuanto todos responden (sin esperar a la tarea horaria) y
-- no se cancelan por falta de participantes hasta que termina el día de inicio.
create or replace function public.challenge_refresh(p_challenge uuid, p_now timestamptz default now()) returns public.challenge_status
language plpgsql security definer set search_path = '' as $$
declare
  c public.challenges;
  today date;
  accepted integer;
  pending_invites integer;
  r record;
  coop_total numeric;
  achieved boolean;
begin
  select * into c from public.challenges where id = p_challenge for update;
  if not found then raise exception 'reto no encontrado'; end if;
  today := public.today_in(c.tz, p_now);

  if c.status = 'pending' and today >= c.starts_on then
    select count(*) into accepted from public.challenge_participants where challenge_id = c.id and status = 'accepted';
    select count(*) into pending_invites from public.challenge_participants where challenge_id = c.id and status = 'invited';
    -- Durante el día de inicio se puede seguir aceptando: solo empieza cuando ya no queda nadie
    -- por responder, y solo se cancela por falta de participantes cuando ese día ha terminado.
    if today = c.starts_on and pending_invites > 0 then
      return c.status;
    end if;
    if accepted < 2 and today = c.starts_on then
      return c.status;
    end if;
    update public.challenge_participants set status = 'declined' where challenge_id = c.id and status = 'invited';
    if accepted >= 2 then
      update public.challenges set status = 'active' where id = c.id;
      for r in select user_id from public.challenge_participants where challenge_id = c.id and status = 'accepted' loop
        perform public.notify(r.user_id, 'challenge_started', 'Empieza «' || c.title || '»', 'El reto ya está en marcha. Las reglas y objetivos quedan fijados.', jsonb_build_object('challenge_id', c.id));
      end loop;
      c.status := 'active';
    else
      update public.challenges set status = 'cancelled', finished_at = p_now where id = c.id;
      perform public.notify(c.created_by, 'challenge_cancelled', '«' || c.title || '» no empezó', 'No hubo suficientes participantes que aceptaran antes del inicio.', jsonb_build_object('challenge_id', c.id));
      return 'cancelled';
    end if;
  end if;

  if c.status = 'active' then
    -- Cooperativo: puede cerrarse antes si se alcanza el objetivo.
    if c.kind = 'cooperative' then
      select coalesce(sum(s.value), 0), bool_and(s.value >= coalesce(c.coop_min_each, 0)) into coop_total, achieved
      from public.compute_standings(c.id, p_now) s where s.status = 'accepted';
      achieved := coop_total >= c.coop_target and (c.coop_mode = 'collective' or achieved);
    end if;
    if p_now >= public.challenge_cutoff(c) or (c.kind = 'cooperative' and achieved) then
      insert into public.challenge_results (challenge_id, user_id, team, rank, value, score, days_active, winner, abandoned)
      select c.id, s.user_id, s.team, s.rank, s.value, s.score, s.days_active,
             c.kind not in ('cooperative', 'pact') and s.rank = 1 and s.status = 'accepted', s.status = 'left'
      from public.compute_standings(c.id, p_now) s;
      update public.challenges set status = 'finished', finished_at = p_now,
        outcome = case when c.kind = 'cooperative' then case when achieved then 'achieved' else 'not_achieved' end else 'completed' end
      where id = c.id;
      for r in select user_id from public.challenge_participants where challenge_id = c.id and status in ('accepted', 'left') loop
        perform public.notify(r.user_id, 'challenge_finished', 'Resultados de «' || c.title || '»',
          case when c.kind = 'cooperative' then case when achieved then '¡Objetivo conseguido en equipo!' else 'El objetivo no se alcanzó esta vez.' end
               when c.kind = 'pact' then 'El pacto ha terminado. Confirma cómo le fue a tu compañero.' else 'Mira la clasificación final.' end,
          jsonb_build_object('challenge_id', c.id));
      end loop;
      return 'finished';
    end if;
  end if;
  return (select status from public.challenges where id = c.id);
end;
$$;
revoke all on function public.challenge_refresh(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.accept_challenge(p_challenge uuid, p_target numeric default null, p_habit uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  c public.challenges;
begin
  select * into c from public.challenges where id = p_challenge;
  if not found or c.status <> 'pending' or public.today_in(c.tz, now()) > c.starts_on then raise exception 'el reto ya no admite cambios'; end if;
  if not exists (select 1 from public.challenge_participants where challenge_id = c.id and user_id = me and status in ('invited', 'accepted')) then raise exception 'no estás invitado'; end if;
  if c.metric in ('percent') or c.kind = 'pact' then
    if p_target is null or p_target <= 0 then raise exception 'define tu objetivo personal'; end if;
  end if;
  if c.source = 'habit' then
    if p_habit is null or not exists (select 1 from public.habits where id = p_habit and user_id = me) then raise exception 'elige uno de tus hábitos'; end if;
    -- En «cantidad total» todos comparan la misma unidad (minutos para hábitos de duración).
    if c.metric = 'quantity' and not exists (
      select 1 from public.habits h where h.id = p_habit
        and (lower(coalesce(h.unit, '')) = lower(c.unit) or (h.kind in ('duration', 'flexible') and lower(c.unit) = 'min'))
    ) then
      raise exception 'el hábito debe usar la misma unidad del reto';
    end if;
  end if;
  update public.challenge_participants set status = 'accepted', personal_target = p_target, habit_id = case when c.source = 'habit' then p_habit end, accepted_at = now()
  where challenge_id = c.id and user_id = me;
  if me <> c.created_by then
    perform public.notify(c.created_by, 'challenge_accepted', public.display_name_of(me) || ' aceptó', '«' || c.title || '»', jsonb_build_object('challenge_id', c.id));
  end if;
  -- Si el reto ya debía empezar (empieza hoy), arranca en cuanto responde el último invitado.
  perform public.challenge_refresh(c.id);
end;
$$;
create or replace function public.decline_challenge(p_challenge uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.challenge_participants set status = 'declined' where challenge_id = p_challenge and user_id = (select auth.uid()) and status = 'invited';
  if found then perform public.challenge_refresh(p_challenge); end if;
end;
$$;

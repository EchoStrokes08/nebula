-- Nebula · F08 — En retos de cantidad con hábitos, todos deben usar la unidad del reto.
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
end;
$$;


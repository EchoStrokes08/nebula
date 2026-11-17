-- Nebula · F03-009 — Comprobar disponibilidad de @usuario sin exponer perfiles.
-- Los handles son identificadores públicos (sirven para buscar amigos), así que revelar si uno
-- está ocupado no filtra datos privados. Nunca se expone el email.
create function public.is_handle_available(candidate text) returns boolean
language sql stable security definer set search_path = '' as $$
  select lower(candidate) ~ '^[a-z0-9_]{3,24}$'
     and not exists (select 1 from public.profiles p where p.handle = lower(candidate));
$$;
revoke all on function public.is_handle_available(text) from public;
grant execute on function public.is_handle_available(text) to anon, authenticated;

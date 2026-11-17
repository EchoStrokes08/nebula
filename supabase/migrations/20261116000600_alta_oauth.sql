-- Nebula · F03-005 — Alta con proveedores OAuth (Google).
-- Google entrega `full_name`/`name` en vez de `display_name`, y no trae @usuario: se genera uno
-- provisional (usuario_xxxxxxxx) que el onboarding ofrece cambiar.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  wanted text := lower(coalesce(meta ->> 'handle', ''));
  final_handle text;
  name text := btrim(coalesce(nullif(meta ->> 'display_name', ''), nullif(meta ->> 'full_name', ''), nullif(meta ->> 'name', ''), ''));
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
  values (new.id, final_handle, left(name, 60), coalesce(nullif(meta ->> 'timezone', ''), 'UTC'));
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end;
$$;

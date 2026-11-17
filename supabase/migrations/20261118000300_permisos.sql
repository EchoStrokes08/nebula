-- Postgres concede EXECUTE a PUBLIC por defecto. Revocar solo a anon no basta:
-- preserva el acceso autenticado de las funciones de la API y quita el heredado de PUBLIC.
do $$
declare f record;
begin
  for f in select p.oid, p.oid::regprocedure as signature,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as client_allowed
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef
  loop
    if f.client_allowed then execute format('grant execute on function %s to authenticated', f.signature); end if;
    execute format('revoke execute on function %s from public, anon', f.signature);
  end loop;
end;
$$;
-- El registro consulta únicamente disponibilidad de un handle, sin devolver datos del perfil.
grant execute on function public.is_handle_available(text) to anon;

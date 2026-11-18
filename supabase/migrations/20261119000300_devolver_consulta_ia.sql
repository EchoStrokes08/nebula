-- Si todos los modelos de IA fallan, la consulta no debe contar para el límite diario.
-- Solo la Edge Function (rol de servicio) puede devolverla: si pudiera hacerlo la propia persona,
-- bastaría con llamar a esta función para saltarse el límite.
create function public.refund_ai_request(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  update public.ai_daily_usage set requests = requests - 1
  where user_id = p_user and day = current_date and requests > 0;
$$;
revoke all on function public.refund_ai_request(uuid) from public, anon, authenticated;
grant execute on function public.refund_ai_request(uuid) to service_role;

-- Un cambio de contribución toca el reto; no se publican los registros privados de hábitos.
alter table public.challenges add column updated_at timestamptz not null default now();
create function public.touch_related_challenges() returns trigger language plpgsql security definer set search_path='' as $$
declare affected uuid;
begin
 if tg_op='DELETE' then affected:=old.user_id; else affected:=new.user_id; end if;
 update public.challenges c set updated_at=clock_timestamp()
 where c.status in ('pending','active') and exists(select 1 from public.challenge_participants p where p.challenge_id=c.id and p.user_id=affected and p.status='accepted');
 return null;
end;
$$;
revoke all on function public.touch_related_challenges() from public,anon,authenticated;
create trigger habit_logs_challenges after insert or update or delete on public.habit_logs for each row execute function public.touch_related_challenges();
create trigger focus_sessions_challenges after insert or update or delete on public.focus_sessions for each row execute function public.touch_related_challenges();
do $$
declare t text;
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['notifications','friend_requests','challenges','challenge_participants','challenge_results','focus_rooms','focus_room_members'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
  end loop;
 end if;
end;
$$;

create table public.focus_rooms (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 1 and 80),
 minutes integer not null check(minutes between 5 and 180),
 starts_at timestamptz,
 closed_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.focus_room_members (
 room_id uuid not null references public.focus_rooms(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'invited' check(status in ('invited','accepted','left')),
 primary key(room_id,user_id)
);
create function public.in_focus_room(r uuid, u uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.focus_room_members m join public.focus_rooms f on f.id=m.room_id
 where m.room_id=r and m.user_id=u and m.status <> 'left' and not public.is_blocked_between(f.owner_id,u));
$$;
revoke all on function public.in_focus_room(uuid,uuid) from public,anon;
grant execute on function public.in_focus_room(uuid,uuid) to authenticated;
alter table public.focus_rooms enable row level security;
alter table public.focus_room_members enable row level security;
create policy focus_rooms_read on public.focus_rooms for select to authenticated using(public.in_focus_room(id,(select auth.uid())));
create policy focus_room_members_read on public.focus_room_members for select to authenticated using(public.in_focus_room(room_id,(select auth.uid())));
revoke all on public.focus_rooms, public.focus_room_members from anon;
revoke insert,update,delete on public.focus_rooms,public.focus_room_members from authenticated;
create function public.create_focus_room(p_title text,p_minutes integer,p_invitees uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=(select auth.uid()); rid uuid; friend uuid;
begin
 if me is null then raise exception 'no autenticado'; end if;
 if cardinality(p_invitees) not between 1 and 20 then raise exception 'invita entre 1 y 20 amigos'; end if;
 if (select count(*) from public.focus_rooms where owner_id=me and created_at>now()-interval '1 day')>=20 then raise exception 'límite diario alcanzado'; end if;
 insert into public.focus_rooms(owner_id,title,minutes) values(me,p_title,p_minutes) returning id into rid;
 insert into public.focus_room_members values(rid,me,'accepted');
 foreach friend in array p_invitees loop
  if not public.are_friends(me,friend) or public.is_blocked_between(me,friend) then raise exception 'solo puedes invitar a amigos'; end if;
  insert into public.focus_room_members values(rid,friend,'invited') on conflict do nothing;
 end loop;
 return rid;
end;
$$;
create function public.respond_focus_room(p_room uuid,p_accept boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.in_focus_room(p_room,(select auth.uid())) then raise exception 'no autorizado'; end if;
 if exists(select 1 from public.focus_rooms where id=p_room and closed_at is not null) then raise exception 'sala cerrada'; end if;
 update public.focus_room_members set status=case when p_accept then 'accepted' else 'left' end where room_id=p_room and user_id=(select auth.uid());
end;
$$;
create function public.start_focus_room(p_room uuid) returns timestamptz language plpgsql security definer set search_path='' as $$
declare result timestamptz;
begin
 update public.focus_rooms set starts_at=now()+interval '10 seconds' where id=p_room and owner_id=(select auth.uid()) and starts_at is null and closed_at is null returning starts_at into result;
 if result is null then raise exception 'no se puede iniciar la sala'; end if;
 return result;
end;
$$;
create function public.close_focus_room(p_room uuid) returns void language sql security definer set search_path='' as $$
 update public.focus_rooms set closed_at=now() where id=p_room and owner_id=(select auth.uid());
$$;
revoke all on function public.create_focus_room(text,integer,uuid[]),public.respond_focus_room(uuid,boolean),public.start_focus_room(uuid),public.close_focus_room(uuid) from public,anon;
grant execute on function public.create_focus_room(text,integer,uuid[]),public.respond_focus_room(uuid,boolean),public.start_focus_room(uuid),public.close_focus_room(uuid) to authenticated;
-- Presencia de Realtime autorizada por pertenencia a la sala, nunca mediante canales públicos.
do $$ begin
 if to_regclass('realtime.messages') is not null then
  execute $p$create policy nebula_room_presence_read on realtime.messages for select to authenticated using(extension='presence' and exists(select 1 from public.focus_rooms r where 'focus-room:'||r.id::text = (select realtime.topic()) and public.in_focus_room(r.id,(select auth.uid()))))$p$;
  execute $p$create policy nebula_room_presence_write on realtime.messages for insert to authenticated with check(extension='presence' and exists(select 1 from public.focus_room_members m where 'focus-room:'||m.room_id::text=(select realtime.topic()) and m.user_id=(select auth.uid()) and m.status='accepted'))$p$;
 end if;
end $$;

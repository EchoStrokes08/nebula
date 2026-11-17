-- Nebula · F08 (1/2) — Amistades, solicitudes, bloqueos, búsqueda, círculos y notificaciones.
-- Las escrituras sociales van por funciones `security definer` que validan reglas (bloqueos,
-- amistad, roles); las tablas no admiten escritura directa desde el cliente.

create type public.friend_request_status as enum ('pending', 'accepted', 'declined', 'cancelled');
create type public.circle_role as enum ('owner', 'admin', 'member');
create type public.invite_status as enum ('pending', 'accepted', 'declined', 'cancelled');

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  status public.friend_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_user <> to_user)
);
create unique index friend_requests_one_pending on public.friend_requests (least(from_user, to_user), greatest(from_user, to_user)) where status = 'pending';

create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create table public.blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_]{3,40}$'),
  title text not null check (char_length(title) <= 120),
  body text not null default '' check (char_length(body) <= 400),
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  description text check (char_length(description) <= 300),
  color text not null default 'violet' check (color in ('violet', 'lavender', 'cyan', 'green', 'amber', 'rose', 'coral', 'sky')),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.circle_members (
  circle_id uuid not null references public.circles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.circle_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create table public.circle_invites (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  invitee uuid not null references public.profiles (id) on delete cascade,
  inviter uuid not null references public.profiles (id) on delete cascade,
  status public.invite_status not null default 'pending',
  created_at timestamptz not null default now()
);
create unique index circle_invites_one_pending on public.circle_invites (circle_id, invitee) where status = 'pending';

-- Utilidades ----------------------------------------------------------------------------------
create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships f where f.user_a = least(a, b) and f.user_b = greatest(a, b));
$$;

create function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks k where (k.blocker = a and k.blocked = b) or (k.blocker = b and k.blocked = a));
$$;

create function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, data) values (p_user, p_kind, left(p_title, 120), left(p_body, 400), p_data);
$$;
revoke all on function public.notify(uuid, text, text, text, jsonb) from public, anon, authenticated;

create function public.display_name_of(u uuid) returns text
language sql stable security definer set search_path = '' as $$
  select display_name from public.profiles where id = u;
$$;
revoke all on function public.display_name_of(uuid) from public, anon;

-- Perfil público: lo que otro usuario puede ver de mí. Nunca incluye email.
-- private: solo handle y nombre (para poder aceptar una solicitud); friends: + avatar si sois amigos.
create function public.search_profiles(q text) returns table (id uuid, handle text, display_name text, avatar_path text, relation text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle, p.display_name,
         case when p.visibility = 'public' or public.are_friends(p.id, (select auth.uid())) then p.avatar_path end,
         case
           when public.are_friends(p.id, (select auth.uid())) then 'friend'
           when exists (select 1 from public.friend_requests r where r.status = 'pending' and r.from_user = (select auth.uid()) and r.to_user = p.id) then 'requested'
           when exists (select 1 from public.friend_requests r where r.status = 'pending' and r.to_user = (select auth.uid()) and r.from_user = p.id) then 'incoming'
           else 'none'
         end
  from public.profiles p
  where (select auth.uid()) is not null
    and p.id <> (select auth.uid())
    and not public.is_blocked_between(p.id, (select auth.uid()))
    and char_length(btrim(q)) >= 2
    and (
      p.handle = lower(btrim(q, ' @'))                                      -- coincidencia exacta: siempre
      or (p.visibility <> 'private' and (p.handle like lower(btrim(q, ' @')) || '%' or p.display_name ilike '%' || btrim(q) || '%'))
    )
  order by (p.handle = lower(btrim(q, ' @'))) desc, p.handle
  limit 20;
$$;

-- Solicitudes ---------------------------------------------------------------------------------
create function public.send_friend_request(p_to uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  rid uuid;
  incoming uuid;
begin
  if me is null then raise exception 'no autenticado'; end if;
  if p_to = me then raise exception 'no puedes enviarte una solicitud'; end if;
  if not exists (select 1 from public.profiles where id = p_to) then raise exception 'usuario no encontrado'; end if;
  if public.is_blocked_between(me, p_to) then raise exception 'no disponible'; end if;
  if public.are_friends(me, p_to) then raise exception 'ya sois amigos'; end if;
  -- Límite anti-spam: 30 solicitudes al día.
  if (select count(*) from public.friend_requests where from_user = me and created_at > now() - interval '1 day') >= 30 then
    raise exception 'demasiadas solicitudes hoy';
  end if;
  -- Si la otra persona ya me había enviado una, se acepta directamente.
  select id into incoming from public.friend_requests where from_user = p_to and to_user = me and status = 'pending';
  if incoming is not null then
    perform public.respond_friend_request(incoming, true);
    return incoming;
  end if;
  insert into public.friend_requests (from_user, to_user) values (me, p_to) returning id into rid;
  perform public.notify(p_to, 'friend_request', 'Nueva solicitud de amistad', public.display_name_of(me) || ' quiere añadirte como amigo.', jsonb_build_object('request_id', rid, 'from', me));
  return rid;
exception when unique_violation then
  raise exception 'ya hay una solicitud pendiente';
end;
$$;

create function public.respond_friend_request(p_request uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.friend_requests;
begin
  select * into r from public.friend_requests where id = p_request for update;
  if not found or r.status <> 'pending' then raise exception 'solicitud no disponible'; end if;
  if r.to_user <> (select auth.uid()) then raise exception 'no autorizado'; end if;
  update public.friend_requests set status = case when p_accept then 'accepted'::public.friend_request_status else 'declined'::public.friend_request_status end, responded_at = now() where id = p_request;
  if p_accept then
    insert into public.friendships (user_a, user_b) values (least(r.from_user, r.to_user), greatest(r.from_user, r.to_user)) on conflict do nothing;
    perform public.notify(r.from_user, 'friend_accepted', 'Solicitud aceptada', public.display_name_of(r.to_user) || ' ha aceptado tu solicitud.', jsonb_build_object('user', r.to_user));
  end if;
end;
$$;

create function public.cancel_friend_request(p_request uuid) returns void
language sql security definer set search_path = '' as $$
  update public.friend_requests set status = 'cancelled', responded_at = now()
  where id = p_request and from_user = (select auth.uid()) and status = 'pending';
$$;

create function public.remove_friend(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.friendships where user_a = least(p_user, (select auth.uid())) and user_b = greatest(p_user, (select auth.uid()));
$$;

create function public.block_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if p_user = me then raise exception 'no puedes bloquearte'; end if;
  insert into public.blocks (blocker, blocked) values (me, p_user) on conflict do nothing;
  delete from public.friendships where user_a = least(p_user, me) and user_b = greatest(p_user, me);
  update public.friend_requests set status = 'cancelled', responded_at = now()
    where status = 'pending' and ((from_user = me and to_user = p_user) or (from_user = p_user and to_user = me));
end;
$$;

create function public.unblock_user(p_user uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.blocks where blocker = (select auth.uid()) and blocked = p_user;
$$;

-- Lista de amigos con su perfil autorizado.
create function public.my_friends() returns table (id uuid, handle text, display_name text, avatar_path text, since timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle, p.display_name, p.avatar_path, f.created_at
  from public.friendships f
  join public.profiles p on p.id = case when f.user_a = (select auth.uid()) then f.user_b else f.user_a end
  where (select auth.uid()) in (f.user_a, f.user_b)
  order by p.display_name;
$$;

-- Solicitudes pendientes (entrantes y salientes) con el nombre de la otra persona.
create function public.my_friend_requests() returns table (id uuid, direction text, other uuid, handle text, display_name text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, case when r.to_user = (select auth.uid()) then 'incoming' else 'outgoing' end,
         p.id, p.handle, p.display_name, r.created_at
  from public.friend_requests r
  join public.profiles p on p.id = case when r.to_user = (select auth.uid()) then r.from_user else r.to_user end
  where r.status = 'pending' and (select auth.uid()) in (r.from_user, r.to_user)
  order by r.created_at desc;
$$;

create function public.my_blocked() returns table (id uuid, handle text, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.handle, p.display_name from public.blocks b join public.profiles p on p.id = b.blocked where b.blocker = (select auth.uid());
$$;

-- Círculos --------------------------------------------------------------------------------------
create function public.circle_role_of(c uuid, u uuid) returns public.circle_role
language sql stable security definer set search_path = '' as $$
  select role from public.circle_members where circle_id = c and user_id = u;
$$;

create function public.create_circle(p_name text, p_description text default null, p_color text default 'violet') returns uuid
language plpgsql security definer set search_path = '' as $$
declare cid uuid; me uuid := (select auth.uid());
begin
  if me is null then raise exception 'no autenticado'; end if;
  insert into public.circles (name, description, color, created_by) values (btrim(p_name), p_description, p_color, me) returning id into cid;
  insert into public.circle_members (circle_id, user_id, role) values (cid, me, 'owner');
  return cid;
end;
$$;

create function public.invite_to_circle(p_circle uuid, p_user uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); iid uuid;
begin
  if public.circle_role_of(p_circle, me) not in ('owner', 'admin') then raise exception 'no autorizado'; end if;
  if not public.are_friends(me, p_user) then raise exception 'solo puedes invitar a amigos'; end if;
  if public.circle_role_of(p_circle, p_user) is not null then raise exception 'ya es miembro'; end if;
  insert into public.circle_invites (circle_id, invitee, inviter) values (p_circle, p_user, me) returning id into iid;
  perform public.notify(p_user, 'circle_invite', 'Invitación a un círculo', public.display_name_of(me) || ' te invita a «' || (select name from public.circles where id = p_circle) || '».', jsonb_build_object('invite_id', iid, 'circle_id', p_circle));
  return iid;
exception when unique_violation then raise exception 'ya hay una invitación pendiente';
end;
$$;

create function public.respond_circle_invite(p_invite uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare i public.circle_invites;
begin
  select * into i from public.circle_invites where id = p_invite for update;
  if not found or i.status <> 'pending' or i.invitee <> (select auth.uid()) then raise exception 'invitación no disponible'; end if;
  update public.circle_invites set status = case when p_accept then 'accepted'::public.invite_status else 'declined'::public.invite_status end where id = p_invite;
  if p_accept then insert into public.circle_members (circle_id, user_id) values (i.circle_id, i.invitee) on conflict do nothing; end if;
end;
$$;

create function public.leave_circle(p_circle uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); next_owner uuid;
begin
  if public.circle_role_of(p_circle, me) = 'owner' then
    select user_id into next_owner from public.circle_members where circle_id = p_circle and user_id <> me order by (role = 'admin') desc, joined_at limit 1;
    if next_owner is null then delete from public.circles where id = p_circle; return; end if;
    update public.circle_members set role = 'owner' where circle_id = p_circle and user_id = next_owner;
  end if;
  delete from public.circle_members where circle_id = p_circle and user_id = me;
end;
$$;

create function public.set_circle_role(p_circle uuid, p_user uuid, p_role public.circle_role) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.circle_role_of(p_circle, (select auth.uid())) <> 'owner' then raise exception 'solo el propietario cambia roles'; end if;
  if p_role = 'owner' or p_user = (select auth.uid()) then raise exception 'cambio no permitido'; end if;
  update public.circle_members set role = p_role where circle_id = p_circle and user_id = p_user;
end;
$$;

create function public.remove_circle_member(p_circle uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare my_role public.circle_role := public.circle_role_of(p_circle, (select auth.uid())); their public.circle_role := public.circle_role_of(p_circle, p_user);
begin
  if my_role is null or my_role = 'member' or their = 'owner' or (my_role = 'admin' and their = 'admin') then raise exception 'no autorizado'; end if;
  delete from public.circle_members where circle_id = p_circle and user_id = p_user;
end;
$$;

-- Lectura de círculos y miembros solo para miembros.
create function public.circle_members_of(p_circle uuid) returns table (user_id uuid, handle text, display_name text, role public.circle_role)
language sql stable security definer set search_path = '' as $$
  select m.user_id, p.handle, p.display_name, m.role from public.circle_members m join public.profiles p on p.id = m.user_id
  where m.circle_id = p_circle and public.circle_role_of(p_circle, (select auth.uid())) is not null
  order by (m.role = 'owner') desc, (m.role = 'admin') desc, p.display_name;
$$;

-- RLS ---------------------------------------------------------------------------------------------
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.notifications enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_invites enable row level security;

create policy friend_requests_read on public.friend_requests for select to authenticated using ((select auth.uid()) in (from_user, to_user));
create policy friendships_read on public.friendships for select to authenticated using ((select auth.uid()) in (user_a, user_b));
create policy blocks_read on public.blocks for select to authenticated using (blocker = (select auth.uid()));
create policy notifications_read on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_mark on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));
create policy circles_read on public.circles for select to authenticated using (public.circle_role_of(circles.id, (select auth.uid())) is not null or exists (select 1 from public.circle_invites i where i.circle_id = circles.id and i.invitee = (select auth.uid()) and i.status = 'pending'));
create policy circles_update on public.circles for update to authenticated using (public.circle_role_of(id, (select auth.uid())) in ('owner', 'admin'));
create policy circle_members_read on public.circle_members for select to authenticated using (public.circle_role_of(circle_id, (select auth.uid())) is not null);
create policy circle_invites_read on public.circle_invites for select to authenticated using ((select auth.uid()) in (invitee, inviter));

revoke insert, update, delete on public.friend_requests, public.friendships, public.blocks, public.circle_members, public.circle_invites from authenticated;
revoke insert, delete on public.circles from authenticated;
revoke insert on public.notifications from authenticated;
-- Solo se puede marcar como leída: sin UPDATE de tabla, con UPDATE de la columna read_at.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke all on public.friend_requests, public.friendships, public.blocks, public.notifications, public.circles, public.circle_members, public.circle_invites from anon;
revoke all on function public.search_profiles(text), public.send_friend_request(uuid), public.respond_friend_request(uuid, boolean), public.cancel_friend_request(uuid),
  public.remove_friend(uuid), public.block_user(uuid), public.unblock_user(uuid), public.my_friends(), public.my_friend_requests(), public.my_blocked(),
  public.create_circle(text, text, text), public.invite_to_circle(uuid, uuid), public.respond_circle_invite(uuid, boolean), public.leave_circle(uuid),
  public.set_circle_role(uuid, uuid, public.circle_role), public.remove_circle_member(uuid, uuid), public.circle_members_of(uuid) from anon;

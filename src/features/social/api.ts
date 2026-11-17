import { db, unwrap } from '@/data/db';

export interface PublicProfile {
  id: string;
  handle: string;
  displayName: string;
  avatarPath: string | null;
}
export type Relation = 'friend' | 'requested' | 'incoming' | 'none';

const rpc = async <T,>(fn: string, args?: Record<string, unknown>) => unwrap(await db().rpc(fn, args)) as T;

export async function searchProfiles(q: string): Promise<(PublicProfile & { relation: Relation })[]> {
  const rows = await rpc<{ id: string; handle: string; display_name: string; avatar_path: string | null; relation: Relation }[]>('search_profiles', { q });
  return rows.map((r) => ({ id: r.id, handle: r.handle, displayName: r.display_name, avatarPath: r.avatar_path, relation: r.relation }));
}

export const sendFriendRequest = (to: string) => rpc<string>('send_friend_request', { p_to: to });
export const respondFriendRequest = (id: string, accept: boolean) => rpc<void>('respond_friend_request', { p_request: id, p_accept: accept });
export const cancelFriendRequest = (id: string) => rpc<void>('cancel_friend_request', { p_request: id });
export const removeFriend = (user: string) => rpc<void>('remove_friend', { p_user: user });
export const blockUser = (user: string) => rpc<void>('block_user', { p_user: user });
export const unblockUser = (user: string) => rpc<void>('unblock_user', { p_user: user });

export async function myFriends(): Promise<(PublicProfile & { since: string })[]> {
  const rows = await rpc<{ id: string; handle: string; display_name: string; avatar_path: string | null; since: string }[]>('my_friends');
  return rows.map((r) => ({ id: r.id, handle: r.handle, displayName: r.display_name, avatarPath: r.avatar_path, since: r.since }));
}

export interface FriendRequest {
  id: string;
  direction: 'incoming' | 'outgoing';
  other: string;
  handle: string;
  displayName: string;
  createdAt: string;
}
export async function myFriendRequests(): Promise<FriendRequest[]> {
  const rows = await rpc<{ id: string; direction: FriendRequest['direction']; other: string; handle: string; display_name: string; created_at: string }[]>('my_friend_requests');
  return rows.map((r) => ({ id: r.id, direction: r.direction, other: r.other, handle: r.handle, displayName: r.display_name, createdAt: r.created_at }));
}

export async function myBlocked(): Promise<{ id: string; handle: string; displayName: string }[]> {
  const rows = await rpc<{ id: string; handle: string; display_name: string }[]>('my_blocked');
  return rows.map((r) => ({ id: r.id, handle: r.handle, displayName: r.display_name }));
}

// Círculos -----------------------------------------------------------------------------------
export interface Circle {
  id: string;
  name: string;
  description: string | null;
  color: string;
  createdBy: string;
}
export async function myCircles(): Promise<Circle[]> {
  const rows = unwrap(await db().from('circles').select('id, name, description, color, created_by').order('created_at')) as { id: string; name: string; description: string | null; color: string; created_by: string }[];
  return rows.map((r) => ({ id: r.id, name: r.name, description: r.description, color: r.color, createdBy: r.created_by }));
}
export const createCircle = (name: string, description: string | null) => rpc<string>('create_circle', { p_name: name, p_description: description });
export const inviteToCircle = (circle: string, user: string) => rpc<string>('invite_to_circle', { p_circle: circle, p_user: user });
export const respondCircleInvite = (id: string, accept: boolean) => rpc<void>('respond_circle_invite', { p_invite: id, p_accept: accept });
export const leaveCircle = (circle: string) => rpc<void>('leave_circle', { p_circle: circle });
export const setCircleRole = (circle: string, user: string, role: 'admin' | 'member') => rpc<void>('set_circle_role', { p_circle: circle, p_user: user, p_role: role });
export const removeCircleMember = (circle: string, user: string) => rpc<void>('remove_circle_member', { p_circle: circle, p_user: user });

export async function circleMembers(circle: string): Promise<{ userId: string; handle: string; displayName: string; role: 'owner' | 'admin' | 'member' }[]> {
  const rows = await rpc<{ user_id: string; handle: string; display_name: string; role: 'owner' | 'admin' | 'member' }[]>('circle_members_of', { p_circle: circle });
  return rows.map((r) => ({ userId: r.user_id, handle: r.handle, displayName: r.display_name, role: r.role }));
}

export async function myCircleInvites(me: string): Promise<{ id: string; circleId: string; circleName: string }[]> {
  const rows = unwrap(await db().from('circle_invites').select('id, circle_id, circles(name)').eq('invitee', me).eq('status', 'pending')) as unknown as { id: string; circle_id: string; circles: { name: string } | null }[];
  return rows.map((r) => ({ id: r.id, circleId: r.circle_id, circleName: r.circles?.name ?? 'Círculo' }));
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { db, unwrap } from '@/data/db';
import { useAuth } from '@/features/auth/session';
export interface Room { id: string; title: string; owner_id: string; minutes: number; starts_at: string | null; closed_at: string | null; focus_room_members: { user_id: string; status: string }[] }
export function useRooms() {
 const uid = useAuth((s) => s.session?.user.id);
 return useQuery({ queryKey: ['rooms', uid], enabled: !!uid, refetchInterval: 5000, queryFn: async () => unwrap(await db().from('focus_rooms').select('*, focus_room_members(user_id,status)').order('created_at', { ascending: false }).limit(30)) as Room[] });
}
export function useRoomMutation() {
 const qc=useQueryClient();
 return useMutation({ mutationFn: async ({ fn, args }: { fn: string; args: Record<string, unknown> }) => unwrap(await db().rpc(fn,args)), onSuccess: () => qc.invalidateQueries({ queryKey: ['rooms'] }) });
}
export function useRoomPresence(id: string, accepted: boolean) {
 const uid=useAuth((s)=>s.session?.user.id); const [count,setCount]=useState<number | null>(null);
 useEffect(()=>{
  if (!uid || !accepted) return;
  const client=db(); const channel=client.channel(`focus-room:${id}`, { config: { private: true, presence: { key: uid } } });
  channel.on('presence', { event: 'sync' }, () => setCount(Object.keys(channel.presenceState()).length));
  channel.subscribe((status)=>{ if(status==='SUBSCRIBED') void channel.track({ online: true }); else if(status==='CHANNEL_ERROR' || status==='TIMED_OUT') setCount(null); });
  return ()=>{ void client.removeChannel(channel); };
 },[id,uid,accepted]);
 return count;
}

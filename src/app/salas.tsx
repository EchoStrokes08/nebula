import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { TextField } from '@/components/forms/TextField';
import { Chip } from '@/components/forms/Chip';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { useFriends } from '@/features/social/hooks';
import { useAuth } from '@/features/auth/session';
import { useRooms, useRoomMutation, useRoomPresence, type Room } from '@/features/rooms/api';
import { useFocus } from '@/features/focus/store';
import { PRESETS } from '@/domain/focus/timer';
import { spacing } from '@/design/tokens';
import { SkeletonList } from '@/components/feedback/Skeleton';
export default function Salas() {
 const list=useRooms(); const friends=useFriends(); const mutation=useRoomMutation();
 const [title,setTitle]=useState('Enfoque en equipo'); const [minutes,setMinutes]=useState('25'); const [invited,setInvited]=useState<string[]>([]);
 return <Screen title="Enfoque compartido" back={{ fallback: '/perfil' }}>
  <Text tone="secondary">Invita a amigos y compartid un inicio. Solo se muestra la presencia en la sala; tus tareas y hábitos siguen siendo privados.</Text>
  <TextField label="Nombre de la sala" value={title} onChangeText={setTitle} maxLength={80} />
  <TextField label="Duración (5–180 min)" value={minutes} onChangeText={setMinutes} keyboardType="numeric" />
  <View style={{ flexDirection:'row', flexWrap:'wrap', gap:spacing[2] }}>{(friends.data??[]).map(f=><Chip key={f.id} label={f.displayName} selected={invited.includes(f.id)} onToggle={()=>setInvited(v=>v.includes(f.id)?v.filter(id=>id!==f.id):[...v,f.id])} />)}</View>
  {!friends.isLoading && !friends.data?.length ? <Button label="Añadir amigos" variant="secondary" onPress={()=>router.push('/amigos')} /> : null}
  <Button label="Crear e invitar" loading={mutation.isPending} disabled={!title.trim() || !invited.length || !/^\d+$/.test(minutes) || +minutes<5 || +minutes>180} onPress={()=>mutation.mutate({ fn:'create_focus_room', args:{ p_title:title.trim(),p_minutes:+minutes,p_invitees:invited } },{onSuccess:()=>setInvited([])})} />
  {mutation.isError ? <Text tone="danger">No se pudo crear la sala. Revisa los amigos seleccionados y tu conexión.</Text>:null}
  {list.isLoading?<SkeletonList rows={3} />:null}
  {list.isError?<Button label="Reintentar cargar salas" onPress={()=>void list.refetch()}/>:null}
  {(list.data??[]).map(room=><RoomCard key={room.id} room={room}/>)}
 </Screen>;
}
function RoomCard({room}:{room:Room}) {
 const uid=useAuth(s=>s.session?.user.id); const mutation=useRoomMutation(); const accepted=room.focus_room_members.some(m=>m.user_id===uid && m.status==='accepted');
 const online=useRoomPresence(room.id,accepted&&!room.closed_at); const [now,setNow]=useState(()=>Date.now()); const timer=useFocus(s=>s.timer);
 useEffect(()=>{ const id=setInterval(()=>setNow(Date.now()),1000); return ()=>clearInterval(id); },[]);
 const remaining=room.starts_at?Math.ceil((new Date(room.starts_at).getTime()-now)/1000):null;
 const ended=room.closed_at || (remaining!==null && remaining < -room.minutes*60);
 return <View style={{gap:spacing[2]}}><Text variant="title3">{room.title} · {room.minutes} min</Text>
  <Text tone="secondary">{ended?'Sala finalizada':remaining===null?'Esperando inicio':remaining>0?`Empieza en ${remaining} s`:'Sesión iniciada'} · {online===null?'Presencia no disponible':`${online} en línea`}</Text>
  {!ended&&!accepted?<Button label="Aceptar invitación" onPress={()=>mutation.mutate({fn:'respond_focus_room',args:{p_room:room.id,p_accept:true}})}/>:null}
  {!ended&&accepted&&room.owner_id===uid&&!room.starts_at?<Button label="Iniciar en 10 segundos" loading={mutation.isPending} onPress={()=>mutation.mutate({fn:'start_focus_room',args:{p_room:room.id}})}/>:null}
  {!ended&&accepted&&remaining!==null&&remaining<=0?<Button label={timer?'Abrir mi sesión de enfoque':'Unirme al enfoque'} onPress={()=>{
   if(!timer) useFocus.getState().start({...PRESETS.custom,focusMinutes:Math.max(1,Math.ceil(room.minutes+remaining/60))},{});
   router.push('/enfoque');
  }}/>:null}
  {!ended?<Button label="Salir de la sala" variant="ghost" onPress={()=>mutation.mutate({fn:room.owner_id===uid?'close_focus_room':'respond_focus_room',args:room.owner_id===uid?{p_room:room.id}:{p_room:room.id,p_accept:false}})}/>:null}
  {mutation.isError?<Text tone="danger">No se pudo completar. Reintenta.</Text>:null}
 </View>;
}

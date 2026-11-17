import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { useAuth } from '@/features/auth/session';
import { useHabitsData } from '@/features/habits/hooks';
import { discardPendingLog, pendingLogs, syncPendingLogs, useConnection } from '@/data/offline/runtime';
import { confirmAction } from '@/lib/confirm';
import { spacing } from '@/design/tokens';
export default function Sincronizacion() {
  const [error,setError]=useState('');
  const uid=useAuth(s=>s.session?.user.id); const status=useConnection(); const {habits}=useHabitsData();
  const list=useQuery({queryKey:['pending_logs',uid],enabled:!!uid,networkMode:'always',refetchInterval:2000,queryFn:()=>pendingLogs(uid!)});
  return <Screen title="Sincronización" back={{fallback:'/hoy'}}>
    <Text tone="secondary">Los registros permanecen en este dispositivo hasta que el servidor confirme su recepción. Los duplicados se evitan mediante su identificador.</Text>
    <Button label="Reintentar sincronización" disabled={!status.online} onPress={()=>void syncPendingLogs()} />
    {error?<Text tone="danger">{error}</Text>:null}
    {status.error?<Text tone="warning">{status.error}</Text>:null}
    {list.isSuccess&&!list.data.length?<Text tone="success">No hay registros pendientes.</Text>:null}
    {list.isError?<Button label="Reintentar leer pendientes" onPress={()=>void list.refetch()}/>:null}
    {(list.data??[]).map(log=><View key={log.clientId} style={{gap:spacing[2]}}>
      <Text>{log.op==='delete'?'Deshacer registro':`${habits.data?.find(h=>h.id===log.habitId)?.name??'Hábito'} · ${log.dayKey} · ${log.value}`}</Text>
      <Button label="Descartar operación pendiente" variant="danger" onPress={()=>confirmAction('Descartar operación pendiente','Solo se descarta si aún no se ha sincronizado. Los datos ya recibidos por el servidor se conservan.','Descartar',()=>{void discardPendingLog(uid!,log.clientId).then(()=>list.refetch()).catch(()=>setError('No se pudo descartar. El registro sigue guardado.'));})}/>
    </View>)}
  </Screen>;
}

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/layout/Screen';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { db, unwrap } from '@/data/db';
import { parseIcs, type ImportedEvent } from '@/domain/integrations/ics';
import { canReadDeviceCalendar, readDeviceCalendar } from '@/platform/calendar';
import { useAuth } from '@/features/auth/session';
import { confirmAction } from '@/lib/confirm';
import { GoogleCalendarBar } from '@/features/agenda/GoogleCalendarBar';

export default function Integraciones() {
  const uid = useAuth((s) => s.session?.user.id); const qc = useQueryClient();
  const [name, setName] = useState('Mi calendario'); const [text, setText] = useState(''); const [device, setDevice] = useState<ImportedEvent[] | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const parsed = useMemo(() => parseIcs(text), [text]); const events = device ?? parsed.events;
  const list = useQuery({ queryKey: ['integrations', uid], enabled: !!uid, queryFn: async () => unwrap(await db().from('integrations').select('id, name, provider, last_imported_at')) as { id: string; name: string; provider: string; last_imported_at: string }[] });
  return <Screen title="Integraciones" back={{ fallback: '/perfil' }}>
    <GoogleCalendarBar detailed />
    <Text variant="title3">Otros calendarios</Text>
    <Text tone="secondary">Importa una copia de tus eventos para que la planificación respete esos compromisos. Reimportar el mismo calendario actualiza eventos por su identificador. La importación es manual.</Text>
    <TextField label="Nombre del calendario" value={name} onChangeText={setName} maxLength={80} />
    <TextField label="Contenido del archivo ICS" multiline value={text} onChangeText={(s) => { setText(s); setDevice(null); }} placeholder="BEGIN:VCALENDAR…" maxLength={2000000} />
    <Text variant="caption" tone="secondary">Admite eventos UTC y de día completo. Las recurrencias y zonas locales no admitidas se omiten con explicación.</Text>
    {canReadDeviceCalendar ? <Button label="Leer calendario del dispositivo (90 días)" variant="secondary" loading={busy} onPress={async () => { setBusy(true); try { setDevice(await readDeviceCalendar()); setMessage('Revisa los eventos antes de importar.'); } catch (e) { setMessage(e instanceof Error ? e.message : 'No se pudo leer el calendario.'); } finally { setBusy(false); } }} /> : null}
    {!device && text ? parsed.warnings.map((w, i) => <Text key={i} tone="warning">{w}</Text>) : null}
    <Text variant="title3">Vista previa: {events.length} eventos</Text>
    {events.slice(0, 20).map((e, i) => <Text key={i}>{e.title} · {e.starts_at.slice(0, 16)}</Text>)}
    {events.length > 20 ? <Text tone="secondary">Y {events.length - 20} más.</Text> : null}
    <Button label="Confirmar importación" loading={busy} disabled={!name.trim() || !events.length} onPress={async () => {
      setBusy(true); setMessage('');
      try { const n = unwrap(await db().rpc('import_calendar', { p_name: name.trim(), p_provider: device ? 'device_calendar' : 'ics', p_events: events })); await qc.invalidateQueries(); setMessage(`${n} eventos importados.`); setText(''); setDevice(null); }
      catch (e) { setMessage(e instanceof Error ? e.message : 'No se pudo importar. Revisa las migraciones del servidor.'); } finally { setBusy(false); }
    }} />
    {message ? <Text accessibilityLiveRegion="polite">{message}</Text> : null}
    <Text variant="title3">Calendarios importados</Text>
    {list.isError ? <Button label="Reintentar cargar integraciones" onPress={() => void list.refetch()} /> : null}
    {(list.data ?? []).map((item) => <Button key={item.id} label={`Quitar ${item.name} y sus eventos`} variant="danger" onPress={() => confirmAction('Quitar calendario', 'Se eliminarán los eventos importados de Nebula. Tu calendario de origen se conserva.', 'Quitar', () => { void (async () => { try { unwrap(await db().from('integrations').delete().eq('id', item.id)); await qc.invalidateQueries(); } catch { setMessage('No se pudo quitar el calendario.'); } })(); })} />)}
  </Screen>;
}

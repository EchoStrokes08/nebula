import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/layout/Screen';
import { TextField } from '@/components/forms/TextField';
import { Chip } from '@/components/forms/Chip';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { purgeOfflineAccount } from '@/data/offline/runtime';
import { db, unwrap } from '@/data/db';
import { markIntentionalSignOut, useAuth } from '@/features/auth/session';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { usePreferences, useUpdatePreferences } from '@/features/profile/usePreferences';
import { pickAndUploadAvatar } from '@/features/profile/avatar';
import { exportMyData } from '@/features/profile/exportData';
import { profileSchema, validateQuietHours } from '@/features/profile/validation';
import { resetReminderSignature } from '@/features/notifications/useReminderSync';
import { notifications } from '@/platform/notifications';
import { confirmAction } from '@/lib/confirm';
import { DesktopSettings } from '@/features/profile/DesktopSettings';
import { SkyPicker } from '@/features/appearance/SkyPicker';
import { DownloadApk } from '@/features/system/DownloadApk';
import { spacing } from '@/design/tokens';

export default function Configuracion() {
  const uid = useAuth((s) => s.session?.user.id);
  const profile = useMyProfile();
  const prefs = usePreferences();
  const update = useUpdatePreferences();
  const qc = useQueryClient();
  const [nameDraft, setName] = useState<string | null>(null); const name = nameDraft ?? profile.data?.display_name ?? '';
  const [handleDraft, setHandle] = useState<string | null>(null); const handle = handleDraft ?? profile.data?.handle ?? '';
  const [tzDraft, setTz] = useState<string | null>(null); const tz = tzDraft ?? profile.data?.timezone ?? '';
  const [weekDraft, setWeek] = useState<0 | 1 | null>(null); const week = weekDraft ?? (profile.data?.week_starts_on === 0 ? 0 : 1);
  const [visibilityDraft, setVisibility] = useState<'private' | 'friends' | 'public' | null>(null); const visibility = visibilityDraft ?? profile.data?.visibility ?? 'private';
  const [startDraft, setStart] = useState<string | null>(null); const start = startDraft ?? prefs.data?.quietHoursStart ?? '';
  const [endDraft, setEnd] = useState<string | null>(null); const end = endDraft ?? prefs.data?.quietHoursEnd ?? '';
  const [limitDraft, setLimit] = useState<string | null>(null); const limit = limitDraft ?? String(prefs.data?.maxNotificationsPerDay ?? 8);
  const [confirmation, setConfirmation] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function act(fn: () => Promise<unknown>, success: string) {
    setBusy(true); setMessage('');
    try { await fn(); setMessage(success); } catch (e) { setMessage(e instanceof Error ? e.message : 'No se pudo completar. Reintenta.'); } finally { setBusy(false); }
  }
  return <Screen title="Configuración" back={{ fallback: '/perfil' }}>
    {(profile.isError || prefs.isError) ? <Button label="Reintentar cargar ajustes" onPress={() => { void profile.refetch(); void prefs.refetch(); }} /> : null}
    <TextField label="Nombre" value={name} onChangeText={setName} maxLength={60} />
    <TextField label="Usuario público" value={handle} onChangeText={setHandle} autoCapitalize="none" maxLength={24} />
    <Button label="Cambiar avatar" variant="secondary" disabled={!uid || busy} onPress={() => void act(async () => {
      const result = await pickAndUploadAvatar(uid!);
      if (result === 'denied') throw new Error('Permite el acceso a fotos desde los ajustes del dispositivo.');
      await qc.invalidateQueries({ queryKey: ['profile', uid] });
    }, 'Avatar actualizado.')} />
    <TextField label="Zona horaria" hint="Ejemplo: America/Bogota" value={tz} onChangeText={setTz} autoCapitalize="none" />
    <Text variant="title3">Inicio de semana</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>{([{ v: 1, l: 'Lunes' }, { v: 0, l: 'Domingo' }] as const).map((w) => <Chip key={w.v} label={w.l} selected={week === w.v} role="radio" onToggle={() => setWeek(w.v)} />)}</View>
    <Text variant="title3">Visibilidad del perfil</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>{([{ v: 'private', l: 'Privado' }, { v: 'friends', l: 'Amigos' }, { v: 'public', l: 'Público' }] as const).map((v) => <Chip key={v.v} label={v.l} selected={visibility === v.v} role="radio" onToggle={() => setVisibility(v.v)} />)}</View>
    <Button label="Guardar perfil" loading={busy} disabled={!profile.data} onPress={() => void act(async () => {
      const parsed = profileSchema.safeParse({ display_name: name, handle, timezone: tz, week_starts_on: week, visibility });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      unwrap(await db().from('profiles').update({ ...parsed.data, timezone_confirmed: true }).eq('id', uid!));
      await qc.invalidateQueries({ queryKey: ['profile', uid] });
    }, 'Perfil guardado.')} />
    <Text variant="title2">Notificaciones</Text>
    <Button label="Permitir notificaciones" variant="secondary" onPress={() => void act(async () => {
      const result = await notifications.requestPermission();
      if (result !== 'granted') throw new Error('Notificaciones desactivadas. Puedes habilitarlas en los ajustes del sistema.');
      await resetReminderSignature();
    }, 'Permiso concedido.')} />
    {prefs.data ? <>
      {(['habits', 'tasks', 'events', 'social', 'weekly_summary', 'motivation'] as const).map((kind) => <View key={kind} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] }}><Text>{{ habits: 'Hábitos', tasks: 'Tareas', events: 'Eventos', social: 'Actividad social', weekly_summary: 'Resumen semanal', motivation: 'Motivación' }[kind]}</Text><Switch accessibilityLabel={`Notificaciones de ${kind}`} value={kind === 'motivation' ? prefs.data!.notifications[kind] !== false : !!prefs.data!.notifications[kind]} disabled={update.isPending} onValueChange={(value) => update.mutate({ notifications: { ...prefs.data!.notifications, [kind]: value } })} /></View>)}
      <TextField label="Silencio desde (HH:MM)" value={start} onChangeText={setStart} placeholder="22:00" />
      <TextField label="Silencio hasta (HH:MM)" value={end} onChangeText={setEnd} placeholder="07:00" />
      <TextField label="Máximo de recordatorios diarios (0–50)" value={limit} onChangeText={setLimit} keyboardType="numeric" />
      <Button label="Guardar recordatorios" disabled={busy || update.isPending} onPress={() => void act(async () => {
        if (!validateQuietHours(start, end)) throw new Error('Escribe las dos horas en formato HH:MM o deja ambas vacías.');
        if (!/^\d+$/.test(limit) || Number(limit) > 50) throw new Error('El máximo debe estar entre 0 y 50.');
        await update.mutateAsync({ quiet_hours_start: start || null, quiet_hours_end: end || null, max_notifications_per_day: Number(limit) });
        await resetReminderSignature();
      }, 'Preferencias guardadas.')} />
      <Text variant="title2">Días activos</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>{['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((label, i) => <Chip key={label} label={label} selected={prefs.data!.activeDays.includes(i)} onToggle={() => update.mutate({ active_days: prefs.data!.activeDays.includes(i) ? prefs.data!.activeDays.filter((d) => d !== i) : [...prefs.data!.activeDays, i] })} />)}</View>
      <Button label="Editar horas de disponibilidad" variant="secondary" onPress={() => router.push('/disponibilidad')} />
      <Text variant="title2">Estilo motivacional</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>{([{ v: 'balanced', l: 'Equilibrado' }, { v: 'demanding', l: 'Exigente' }, { v: 'intense', l: 'Intenso' }] as const).map((v) => <Chip key={v.v} label={v.l} selected={prefs.data!.motivationIntensity === v.v} role="radio" onToggle={() => update.mutate({ motivation_intensity: v.v })} />)}</View>
      <Text variant="title2">Inteligencia artificial</Text>
      <Text tone="secondary">Con tu autorización, el asistente envía tu petición y un resumen de tu actividad (hábitos, tareas, metas, agenda y lo que escribas en «Sobre mí») al proveedor configurado. Solo envía tu diario si lo activas en el asistente. Nunca correos ni actividad de amigos. Las acciones requieren tu confirmación.</Text>
      <Switch accessibilityLabel="Permitir asistente de IA" value={prefs.data.aiEnabled} disabled={update.isPending} onValueChange={(value) => update.mutate({ ai_enabled: value })} />
    </> : null}
    {update.isError ? <Text tone="danger">No se guardó el cambio. Reintenta.</Text> : null}
    <Text variant="title2">Apariencia</Text>
    <Text tone="secondary">Elige el cielo de fondo. En automático cambia con la hora del día y cada día dibuja una galaxia distinta.</Text>
    <SkyPicker />
    <DownloadApk />
    <DesktopSettings />
    <Text variant="title2">Tus datos</Text>
    <Button label="Exportar mis datos (JSON)" variant="secondary" loading={busy} onPress={() => void act(exportMyData, 'Exportación preparada.')} />
    <Text tone="secondary">Eliminar tu cuenta borra tus hábitos, tareas, metas y datos personales. Es irreversible. Escribe ELIMINAR para continuar.</Text>
    <TextField label="Confirmación de borrado" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" />
    <Button label="Eliminar mi cuenta" variant="danger" disabled={confirmation !== 'ELIMINAR' || busy} onPress={() => confirmAction('Eliminar tu cuenta', 'Se borrarán todos tus datos. Esta acción no se puede deshacer.', 'Eliminar definitivamente', () => void act(async () => {
      const { error } = await db().functions.invoke('account-delete', { body: { confirmation } });
      if (error) throw new Error('No se pudo eliminar la cuenta. Comprueba que la función account-delete esté desplegada y reintenta.');
      markIntentionalSignOut();
      await db().auth.signOut({ scope: 'local' });
      if (uid) await purgeOfflineAccount(uid);
      qc.clear();
    }, 'Cuenta eliminada.'))} />
    {message ? <Text accessibilityLiveRegion="polite">{message}</Text> : null}
  </Screen>;
}

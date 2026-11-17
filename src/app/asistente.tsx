import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Screen } from '@/components/layout/Screen';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { db } from '@/data/db';
import { assistanceSchema } from '@/domain/capture/actions';
import { useHabitsData, useHabitMutation } from '@/features/habits/hooks';
import { setTarget } from '@/features/habits/api';
import { useToday, useTimeZone } from '@/features/habits/useToday';
import { useTasks } from '@/features/tasks/hooks';
import { usePreferences } from '@/features/profile/usePreferences';
import { buildInsights, weeklySummary } from '@/features/intelligence/insights';
import { ActionCard } from '@/features/intelligence/ActionCard';
import { spacing } from '@/design/tokens';
import { SkeletonList } from '@/components/feedback/Skeleton';

type Response = ReturnType<typeof assistanceSchema.parse>;
export default function Asistente() {
  const data = useHabitsData(); const tasks = useTasks(); const prefs = usePreferences(); const today = useToday(); const tz = useTimeZone();
  const [request, setRequest] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [conversation, setConversation] = useState<{ request: string; response: Response }[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const adapt = useHabitMutation(async ({ id, target }: { id: string; target: number }) => {
    const habit = data.habits.data?.find((h) => h.id === id);
    const current = habit?.targets.filter((t) => t.validFrom <= today).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
    if (!current) throw new Error('No se pudo cargar el objetivo.');
    await setTarget(id, today, { ...current, target });
  });
  const insights = useMemo(() => buildInsights(data.habits.data ?? [], data.logs.data ?? [], tasks.data ?? [], today), [data.habits.data, data.logs.data, tasks.data, today]);
  return <Screen title="Asistente" back={{ fallback: '/hoy' }}>
    <Text tone="secondary">Recomendaciones basadas en tus registros. Tú decides qué cambiar.</Text>
    {data.habits.isLoading || tasks.isLoading ? <SkeletonList rows={3} /> : null}
    {data.habits.isError || data.logs.isError || tasks.isError ? <Button label="Reintentar cargar actividad" onPress={() => { void data.habits.refetch(); void data.logs.refetch(); void tasks.refetch(); }} /> : null}
    {!insights.length && data.habits.data && tasks.data ? <Text tone="secondary">No hay señales suficientes para recomendar cambios. Sigue registrando tu actividad.</Text> : null}
    {insights.filter((i) => !dismissed.includes(i.id)).map((i) => <View key={i.id} style={{ gap: spacing[2] }}>
      <Text variant="title3">{i.title}</Text><Text tone="secondary">{i.reason}</Text>
      {i.action ? <ActionCard action={i.action} /> : i.habitId && i.suggestedTarget ? <Button label={`Aplicar objetivo de ${i.suggestedTarget}`} loading={adapt.isPending} onPress={() => adapt.mutate({ id: i.habitId!, target: i.suggestedTarget! }, { onSuccess: () => setDismissed((d) => [...d, i.id]) })} /> : <Button label="Revisar planificación" variant="secondary" onPress={() => router.push('/planificar')} />}
      <Button label="Descartar sugerencia" variant="ghost" onPress={() => setDismissed((d) => [...d, i.id])} />
    </View>)}
    {adapt.isError ? <Text tone="danger">No se pudo aplicar el objetivo. Reintenta.</Text> : null}
    <Text variant="title2">Asistente de IA</Text>
    <Text tone="secondary">Al enviar, compartes tu petición y un resumen numérico de la última semana con el proveedor del servidor. No se envían nombres de amigos ni tu diario. La respuesta propone acciones; no las ejecuta.</Text>
    {!prefs.data?.aiEnabled ? <Text tone="secondary">IA desactivada. Puedes habilitarla en Configuración. La captura rápida y las recomendaciones siguen disponibles.</Text> : <>
      <TextField label="Tu petición" value={request} onChangeText={setRequest} multiline maxLength={2000} placeholder="Ayúdame a dividir mi próxima meta en pasos" />
      <Button label="Enviar al asistente" loading={busy} disabled={!request.trim()} onPress={async () => {
        setBusy(true); setError('');
        try {
          const summary = weeklySummary(tasks.data ?? [], data.logs.data ?? [], today, tz);
          const r = await db().functions.invoke('ai-assist', { body: { message: request, context: summary } });
          if (r.error) throw new Error('El proveedor no está disponible o alcanzaste el límite diario. Puedes usar la captura rápida y reintentar más tarde.');
          const response = assistanceSchema.parse(r.data);
          setConversation((c) => [...c, { request, response }]); setRequest('');
        } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo consultar al asistente.'); } finally { setBusy(false); }
      }} />
    </>}
    {error ? <Text tone="warning" accessibilityLiveRegion="polite">{error}</Text> : null}
    {conversation.map((turn, i) => <View key={i} style={{ gap: spacing[3] }}><Text variant="bodyStrong">{turn.request}</Text><Text>{turn.response.message}</Text>{turn.response.actions.map((a, j) => <ActionCard key={j} action={a} />)}</View>)}
    <Button label="Captura sin IA" variant="secondary" onPress={() => router.push('/captura')} />
  </Screen>;
}

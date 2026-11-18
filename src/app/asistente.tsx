import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { BookOpen, CalendarDays, CheckSquare, ChevronDown, ChevronUp, Flag, Flame, GraduationCap, Lightbulb, Send, Sparkles, Swords, UserRound, Wand2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { RichText } from '@/components/content/RichText';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Switch } from '@/components/forms/Switch';
import { TextArea } from '@/components/forms/TextArea';
import { SkeletonList } from '@/components/feedback/Skeleton';
import { Screen } from '@/components/layout/Screen';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { Button } from '@/components/primitives/Button';
import { Card, glassBlur } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import { db } from '@/data/db';
import { assistanceSchema } from '@/domain/capture/actions';
import type { AssistantTone } from '@/domain/assistant/context';
import { colors, fontFamily, gradients, radius, spacing } from '@/design/tokens';
import { contextCounts } from '@/features/assistant/buildContext';
import { looksLikePlanRequest, PLAN_TEMPLATE, planPromptFor } from '@/features/assistant/planPrompts';
import { useAssistantContext } from '@/features/assistant/useAssistantContext';
import { setTarget } from '@/features/habits/api';
import { useHabitMutation, useHabitsData } from '@/features/habits/hooks';
import { useToday } from '@/features/habits/useToday';
import { ActionCard } from '@/features/intelligence/ActionCard';
import { appVersion } from '@/features/system/update';
import { getDesktopBridge } from '@/platform/desktopBridge';
import { useUpdatePreferences } from '@/features/profile/usePreferences';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { askWithRetry } from '@/domain/assistant/errors';

type Response = ReturnType<typeof assistanceSchema.parse>;
interface Turn { request: string; response: Response }

const SUGGESTIONS = [
  { label: 'Planifica mi día', prompt: 'Organiza mi día de hoy con mis tareas, hábitos y huecos libres de la agenda. Propón bloques concretos.' },
  { label: '¿Cómo voy esta semana?', prompt: 'Analiza mi última semana: hábitos, tareas completadas y enfoque. Dime qué va bien y qué mejorar.' },
  { label: 'Hábito que necesita atención', prompt: '¿Qué hábito estoy descuidando y cómo lo retomo sin agobiarme?' },
  { label: 'Desbloquea lo aplazado', prompt: 'Mira mis tareas aplazadas o bloqueadas y ayúdame a desbloquearlas con primeros pasos pequeños.' },
  { label: 'Avanza en mis metas', prompt: 'Revisa mis metas activas y propón el siguiente paso concreto para cada una.' },
  { label: 'Prepara mi semana', prompt: 'Prepárame la semana que viene teniendo en cuenta mi agenda, mis metas y mis días activos.' },
  { label: 'Dame un empujón', prompt: 'Necesito motivación para ponerme ahora. Dame un empujón basado en lo que llevo conseguido.' },
];

const TONES: { value: AssistantTone; label: string }[] = [
  { value: 'cercano', label: 'Cercano' },
  { value: 'directo', label: 'Directo' },
  { value: 'motivador', label: 'Motivador' },
  { value: 'tranquilo', label: 'Tranquilo' },
];

function Orb({ size = 44 }: { size?: number }) {
  return (
    <LinearGradient colors={gradients.aurora} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.orb, { width: size, height: size, borderRadius: size / 2 }]}>
      <Sparkles size={size * 0.45} color="#fff" strokeWidth={2} />
    </LinearGradient>
  );
}

function Personalize() {
  const ctx = useAssistantContext();
  const update = useUpdatePreferences();
  const [about, setAbout] = useState<string | null>(null);
  const prefs = ctx.prefs.data;
  if (!prefs) return null;
  const value = about ?? prefs.aiAbout;
  return (
    <Card>
      <SectionHeader icon={UserRound} title="Lo que Nebula sabe de ti" color={colors.accentSoft} />
      <Text variant="callout" tone="secondary">Cuéntale a qué te dedicas, tus horarios, qué te motiva o qué te cuesta. Lo tendrá en cuenta en cada respuesta.</Text>
      <TextArea label="Sobre mí" value={value} onChangeText={setAbout} maxLength={1500} placeholder="Ej.: Estudio ingeniería, trabajo por las tardes, rindo mejor por la mañana y me cuesta empezar las tareas largas." />
      <SegmentedControl label="Tono del asistente" segments={TONES} value={prefs.aiTone} onChange={(v) => update.mutate({ ai_tone: v })} />
      <Switch label="Compartir mi diario" description="Incluye tus últimas entradas del diario para que entienda mejor cómo te va." value={prefs.aiShareJournal} onChange={(v) => update.mutate({ ai_share_journal: v })} />
      <Button label={update.isSuccess && about === null ? 'Guardado' : 'Guardar'} variant="secondary" disabled={about === null || about === prefs.aiAbout} loading={update.isPending} onPress={() => update.mutate({ ai_about: value.trim() }, { onSuccess: () => setAbout(null) })} />
      {update.isError ? <Text tone="danger">No se pudo guardar. Reintenta.</Text> : null}
    </Card>
  );
}

export default function Asistente() {
  const params = useLocalSearchParams<{ meta?: string }>();
  const ctx = useAssistantContext();
  const data = useHabitsData();
  const today = useToday();
  const reduced = useReducedMotion();
  const goalParam = typeof params.meta === 'string' ? params.meta : '';
  const [request, setRequest] = useState(() => (goalParam ? planPromptFor(goalParam) : ''));
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [busy, setBusy] = useState(false);
  /** Aviso mientras se reintenta solo tras una saturación momentánea. */
  const [retrying, setRetrying] = useState('');
  const [error, setError] = useState('');
  const [conversation, setConversation] = useState<Turn[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [showShared, setShowShared] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoApply, setAutoApply] = useState(false);
  const adapt = useHabitMutation(async ({ id, target }: { id: string; target: number }) => {
    const habit = data.habits.data?.find((h) => h.id === id);
    const current = habit?.targets.filter((t) => t.validFrom <= today).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
    if (!current) throw new Error('No se pudo cargar el objetivo.');
    await setTarget(id, today, { ...current, target });
  });

  const aiEnabled = !!ctx.prefs.data?.aiEnabled;
  const counts = ctx.preview ? contextCounts(ctx.preview) : null;
  const enter = reduced ? undefined : FadeInDown.duration(320);

  const send = async (message: string) => {
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    try {
      const context = ctx.build();
      const history = conversation.slice(-4).flatMap((t) => [
        { role: 'user' as const, text: t.request.slice(0, 2000) },
        { role: 'assistant' as const, text: t.response.message.slice(0, 2000) },
      ]);
      const ask = async () => {
        let r = await db().functions.invoke('ai-assist', { body: { message: text, context, history, client: { version: appVersion(), platform: Platform.OS === 'web' && getDesktopBridge() ? 'desktop' : Platform.OS } } });
        // Servidor aún sin desplegar la versión con contexto completo: reintenta con el resumen antiguo.
        if (r.error && (r.error as { context?: { status?: number } }).context?.status === 400) {
          const legacy = { from: context.week.from, to: context.week.to, tasksCompleted: context.week.tasksCompleted, habitRecords: context.week.habitRecords, activeDays: context.week.activeDays };
          r = await db().functions.invoke('ai-assist', { body: { message: text, context: legacy } });
        }
        return r;
      };
      // Saturación o corte momentáneo: espera unos segundos y reintenta sola (como mucho dos veces).
      const r = await askWithRetry(ask, setRetrying);
      const response = assistanceSchema.parse(r.data);
      setConversation((c) => [...c, { request: text, response }]);
      setRequest('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo consultar al asistente.');
    } finally {
      setBusy(false);
      setRetrying('');
    }
  };

  const chips = counts
    ? [
        { icon: Flame, n: counts.habits, label: 'hábitos', color: colors.warning },
        { icon: CheckSquare, n: counts.tasks, label: 'tareas', color: colors.info },
        { icon: Flag, n: counts.goals, label: 'metas', color: colors.success },
        { icon: CalendarDays, n: counts.events, label: 'eventos', color: colors.accentSoft },
        { icon: Swords, n: counts.challenges, label: 'retos', color: '#E58FD0' },
        ...(counts.journal ? [{ icon: BookOpen, n: counts.journal, label: 'diario', color: colors.textSecondary }] : []),
      ]
    : [];
  const visibleInsights = ctx.insights.filter((i) => !dismissed.includes(i.id));

  return (
    <Screen title="Nebula IA" overline="Tu asistente personal" subtitle="Conoce tus hábitos, tareas, metas y agenda para ayudarte de verdad." back={{ fallback: '/hoy' }}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, glassBlur]}>
        <View style={styles.heroTop}>
          <Orb />
          <View style={styles.flex}>
            <Text variant="title2">{ctx.name ? `Hola, ${ctx.name}` : 'Hola'} ✦</Text>
            <Text variant="callout" tone="secondary">{aiEnabled ? 'Pregúntame lo que quieras sobre tu día, tu semana o tus metas.' : 'Activa la IA para conversar conmigo.'}</Text>
          </View>
        </View>
        {ctx.isLoading ? <SkeletonList rows={1} /> : (
          <View style={styles.chips}>
            {chips.map((c) => (
              <View key={c.label} style={styles.ctxChip}>
                <c.icon size={14} color={c.color} />
                <Text variant="caption" tabular>{c.n} {c.label}</Text>
              </View>
            ))}
          </View>
        )}
        <Pressable onPress={() => setShowShared((s) => !s)} accessibilityRole="button" style={styles.linkRow} hitSlop={6}>
          <Text variant="caption" tone="accent">Qué comparto con la IA</Text>
          {showShared ? <ChevronUp size={14} color={colors.accentSoft} /> : <ChevronDown size={14} color={colors.accentSoft} />}
        </Pressable>
        {showShared ? (
          <Text variant="caption" tone="secondary">
            Al enviar, se comparten tu petición, las últimas respuestas y un resumen de tu actividad: nombre de pila, «Sobre mí», preferencias, hábitos con rachas, tareas abiertas, metas, eventos de los próximos 7 días, retos propios{ctx.prefs.data?.aiShareJournal ? ', entradas recientes del diario' : ''} y estadísticas de la semana. Nunca datos de amigos, emails ni tokens. Nada se guarda en Nebula y las propuestas no se aplican sin tu confirmación.
          </Text>
        ) : null}
      </LinearGradient>

      {!aiEnabled ? (
        <Card tone="warning">
          <Text variant="bodyStrong">La IA está desactivada</Text>
          <Text variant="callout" tone="secondary">Puedes habilitarla en Configuración. La captura rápida y las observaciones siguen disponibles.</Text>
          <Button label="Ir a Configuración" variant="secondary" onPress={() => router.push('/configuracion')} />
        </Card>
      ) : (
        <>
          {conversation.length === 0 ? (
            <View style={styles.suggestions}>
              <Pressable
                onPress={() => { setRequest(PLAN_TEMPLATE); setTimeout(() => input.current?.focus(), 0); }}
                disabled={busy}
                accessibilityRole="button"
                accessibilityHint="Escribe tu meta en el cuadro y envía"
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.suggestion, styles.planSuggestion, (pressed || hovered) && styles.suggestionActive]}
              >
                <GraduationCap size={14} color={colors.success} />
                <Text variant="callout">No sé cómo lograr una meta</Text>
              </Pressable>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s.label} onPress={() => void send(s.prompt)} disabled={busy} accessibilityRole="button" style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.suggestion, (pressed || hovered) && styles.suggestionActive]}>
                  <Wand2 size={14} color={colors.accentSoft} />
                  <Text variant="callout">{s.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {conversation.map((turn, i) => (
            <Animated.View key={i} entering={enter} style={styles.turn}>
              <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.userBubble}>
                <Text style={styles.userText}>{turn.request}</Text>
              </LinearGradient>
              <View style={styles.botRow}>
                <Orb size={30} />
                <View style={[styles.botBubble, glassBlur]}>
                  <RichText>{turn.response.message}</RichText>
                </View>
              </View>
              {turn.response.actions.map((a, j) => <ActionCard key={j} action={a} autoApply={autoApply && i === conversation.length - 1} />)}
            </Animated.View>
          ))}
          {busy ? (
            <View style={styles.botRow}>
              <Orb size={30} />
              <View style={[styles.botBubble, glassBlur]}><Text tone="secondary">{retrying || (looksLikePlanRequest(request) ? 'Preparando tu plan y comprobando enlaces…' : 'Pensando con tus datos…')}</Text></View>
            </View>
          ) : null}
          {error ? <Text tone="warning" accessibilityLiveRegion="polite">{error}</Text> : null}

          <View style={[styles.composer, glassBlur]}>
            <TextInput
              ref={input}
              value={request}
              onChangeText={setRequest}
              placeholder={conversation.length ? 'Sigue la conversación…' : 'Pregunta a Nebula…'}
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={2000}
              accessibilityLabel="Tu petición"
              style={styles.input}
              onKeyPress={(e) => {
                const ev = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
                if (ev.key === 'Enter' && !ev.shiftKey) { (e as unknown as { preventDefault?: () => void }).preventDefault?.(); void send(request); }
              }}
            />
            <Pressable onPress={() => void send(request)} disabled={!request.trim() || busy} accessibilityRole="button" accessibilityLabel="Enviar al asistente" style={[styles.sendBtn, (!request.trim() || busy) && styles.disabled]}>
              <Send size={18} color="#fff" />
            </Pressable>
          </View>
          <Switch label="Aplicar automáticamente" description="Nebula crea al momento las tareas, hábitos, metas y planes que proponga. Mover o cambiar tareas existentes sigue pidiendo confirmación." value={autoApply} onChange={setAutoApply} />
          {conversation.length ? <Button label="Nueva conversación" variant="ghost" onPress={() => { setConversation([]); setError(''); }} /> : null}
        </>
      )}

      {visibleInsights.length ? (
        <View style={styles.section}>
          <SectionHeader icon={Lightbulb} title="Observaciones" meta={String(visibleInsights.length)} color={colors.warning} />
          {visibleInsights.map((i) => (
            <Card key={i.id} compact>
              <Text variant="bodyStrong">{i.title}</Text>
              <Text variant="callout" tone="secondary">{i.reason}</Text>
              {i.action ? <ActionCard action={i.action} /> : i.habitId && i.suggestedTarget ? (
                <Button label={`Aplicar objetivo de ${i.suggestedTarget}`} loading={adapt.isPending} onPress={() => adapt.mutate({ id: i.habitId!, target: i.suggestedTarget! }, { onSuccess: () => setDismissed((d) => [...d, i.id]) })} />
              ) : <Button label="Revisar planificación" variant="secondary" onPress={() => router.push('/planificar')} />}
              <Button label="Descartar" variant="ghost" onPress={() => setDismissed((d) => [...d, i.id])} />
            </Card>
          ))}
          {adapt.isError ? <Text tone="danger">No se pudo aplicar el objetivo. Reintenta.</Text> : null}
        </View>
      ) : null}

      <Pressable onPress={() => setShowSettings((s) => !s)} accessibilityRole="button" style={styles.linkRow}>
        <UserRound size={16} color={colors.accentSoft} />
        <Text variant="bodyStrong" tone="accent">Personalizar a Nebula</Text>
        {showSettings ? <ChevronUp size={16} color={colors.accentSoft} /> : <ChevronDown size={16} color={colors.accentSoft} />}
      </Pressable>
      {showSettings ? <Personalize /> : null}
      <Button label="Captura rápida sin IA" variant="secondary" onPress={() => router.push('/captura')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: spacing[3] },
  hero: { gap: spacing[4], padding: spacing[5], borderRadius: radius.xl + 4, borderWidth: 1, borderColor: 'rgba(199, 169, 255, 0.35)', overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  orb: { alignItems: 'center', justifyContent: 'center', shadowColor: colors.accent, shadowOpacity: 0.8, shadowRadius: 16, elevation: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  ctxChip: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(11, 8, 21, 0.5)', borderWidth: 1, borderColor: 'rgba(199, 169, 255, 0.16)' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderStrong },
  planSuggestion: { borderColor: 'rgba(110, 231, 183, 0.45)' },
  suggestionActive: { backgroundColor: colors.accentMuted, borderColor: colors.accentBright },
  turn: { gap: spacing[3] },
  userBubble: { alignSelf: 'flex-end', maxWidth: '86%', paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.lg, borderBottomRightRadius: 6 },
  userText: { color: '#fff' },
  botRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  botBubble: { flex: 1, padding: spacing[4], borderRadius: radius.lg, borderTopLeftRadius: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2], padding: spacing[2], paddingLeft: spacing[4], borderRadius: radius.xl, backgroundColor: colors.cardRaised, borderWidth: 1, borderColor: colors.borderStrong },
  input: { flex: 1, minHeight: 44, maxHeight: 160, paddingVertical: spacing[3], color: colors.text, fontFamily: fontFamily.regular, fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  disabled: { opacity: 0.4 },
});

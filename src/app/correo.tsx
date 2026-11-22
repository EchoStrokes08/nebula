import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { Inbox, Mail } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { SkeletonList } from '@/components/feedback/Skeleton';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { Screen } from '@/components/layout/Screen';
import { useToast } from '@/components/overlays/UndoToast';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { gmailThreadUrl, MAIL_KIND_LABEL } from '@/domain/mail/triage';
import { useAuth } from '@/features/auth/session';
import { taskKeys } from '@/features/tasks/hooks';
import {
  completePendingGmail, connectGmail, disconnectGmail, fetchMailSuggestions, gmailConnected, setMailStatus,
  suggestionToTask, triageMail, type MailSuggestion,
} from '@/features/mail/api';
import { confirmAction } from '@/lib/confirm';

type View_ = 'pending' | 'info' | 'closed';

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });
const dueLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });

function SuggestionCard({ s, onTask, onStatus, busy }: { s: MailSuggestion; onTask(): void; onStatus(status: 'done' | 'dismissed' | 'new'): void; busy: boolean }) {
  const open = s.status === 'new';
  const actionable = s.kind === 'todo' || s.kind === 'waiting';
  return (
    <View style={[styles.card, open && actionable && s.priority === 1 && styles.urgent]}>
      <Text variant="caption" tone="tertiary">{MAIL_KIND_LABEL[s.kind]} · {s.sender} · {shortDate(s.receivedAt)}</Text>
      <Text variant="bodyStrong">{s.title ?? s.subject}</Text>
      {s.title ? <Text variant="callout" tone="secondary">«{s.subject}»</Text> : null}
      {s.reason ? <Text variant="caption" tone="secondary">{s.reason}</Text> : null}
      {s.dueDate ? <Text variant="caption" tone={s.priority === 1 ? 'warning' : 'accent'}>Para el {dueLabel(s.dueDate)}</Text> : null}
      {s.status === 'task' ? <Text variant="caption" tone="success">Convertido en tarea</Text> : null}
      <View style={styles.actions}>
        {open && actionable ? <Button label="Crear tarea" variant="secondary" loading={busy} onPress={onTask} /> : null}
        {open && actionable ? <Button label="Hecho" variant="ghost" disabled={busy} onPress={() => onStatus('done')} /> : null}
        {open ? <Button label={actionable ? 'Descartar' : 'Archivar'} variant="ghost" disabled={busy} onPress={() => onStatus('dismissed')} /> : null}
        {!open && s.status !== 'task' ? <Button label="Recuperar" variant="ghost" disabled={busy} onPress={() => onStatus('new')} /> : null}
        <Button label="Abrir en Gmail" variant="ghost" onPress={() => void Linking.openURL(gmailThreadUrl(s.threadId))} />
      </View>
    </View>
  );
}

/** Correo de Gmail clasificado por la IA: qué tienes pendiente, qué esperas y qué es solo informativo. */
export default function Correo() {
  const uid = useAuth((s) => s.session?.user.id);
  const qc = useQueryClient();
  const toast = useToast((t) => t.show);
  const [view, setView] = useState<View_>('pending');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState<string | null>(null);

  const connected = useQuery({ queryKey: ['gmail', uid, 'connected'], enabled: !!uid, queryFn: gmailConnected, retry: 1 });
  const list = useQuery({ queryKey: ['gmail', uid, 'suggestions'], enabled: !!uid, queryFn: fetchMailSuggestions });
  const refresh = () => qc.invalidateQueries({ queryKey: ['gmail', uid] });

  // Web: la conexión vuelve por redirección de página completa y se termina aquí.
  useEffect(() => {
    if (!uid) return;
    completePendingGmail()
      .then((done) => { if (done) { toast('Gmail conectado.'); void refresh(); } })
      .catch((e) => setMessage(e instanceof Error ? e.message : 'No se pudo conectar Gmail.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const review = useMutation({
    mutationFn: triageMail,
    onMutate: () => setMessage(''),
    onSuccess: async (r) => {
      setMessage(r.added ? `${r.added} correos nuevos revisados.${r.pending ? ` Quedan ${r.pending} para la próxima revisión.` : ''}` : 'No hay correo nuevo que revisar.');
      await refresh();
    },
    onError: async (e) => { setMessage(e instanceof Error ? e.message : 'No se pudo revisar el correo.'); await refresh(); },
  });

  const connect = useMutation({
    mutationFn: connectGmail,
    onMutate: () => setMessage(''),
    onSuccess: async (r) => {
      if (r === 'cancelled') { setMessage('Conexión cancelada.'); return; }
      if (r === 'connected') { await refresh(); review.mutate(); }
    },
    onError: (e) => setMessage(e instanceof Error ? e.message : 'No se pudo conectar Gmail.'),
  });

  const act = async (s: MailSuggestion, fn: () => Promise<unknown>, done?: string) => {
    setWorking(s.messageId);
    try { await fn(); if (done) toast(done); await refresh(); if (done) await qc.invalidateQueries({ queryKey: taskKeys.all(uid) }); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'No se pudo guardar.'); }
    finally { setWorking(null); }
  };

  const items = list.data ?? [];
  const shown = items.filter((s) =>
    view === 'pending' ? s.status === 'new' && (s.kind === 'todo' || s.kind === 'waiting')
    : view === 'info' ? s.status === 'new' && s.kind === 'info'
    : s.status !== 'new');
  // Pendientes primero por prioridad y fecha límite; el resto, del más reciente al más antiguo.
  if (view === 'pending') shown.sort((a, b) => a.priority - b.priority || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const pendingCount = items.filter((s) => s.status === 'new' && (s.kind === 'todo' || s.kind === 'waiting')).length;
  const ignored = items.filter((s) => s.status === 'new' && s.kind === 'ignore').length;
  const isConnected = connected.data === true;

  return (
    <Screen title="Correo" subtitle="Lo que tienes pendiente en Gmail" back={{ fallback: '/perfil' }}>
      <View style={styles.bar}>
        <View style={styles.row}>
          <Mail size={18} color={colors.info} />
          <View style={styles.flex}>
            <Text variant="bodyStrong">Gmail</Text>
            <Text variant="caption" tone="tertiary">
              {isConnected
                ? 'Revisa tus correos de las últimas dos semanas (sin promociones ni redes sociales) y te propone tareas. Tú decides cuáles crear.'
                : 'Solo lectura: Nebula no envía, borra ni cambia nada en tu correo. A la IA solo llegan remitente, asunto y un fragmento.'}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          {isConnected
            ? <Button label="Revisar correo" loading={review.isPending} onPress={() => review.mutate()} />
            : <Button label="Conectar Gmail" loading={connect.isPending || connected.isLoading} onPress={() => connect.mutate()} />}
          {isConnected ? <Button label="Desconectar" variant="ghost" onPress={() => confirmAction('Desconectar Gmail', 'Nebula dejará de leer tu correo y borrará las sugerencias guardadas. Las tareas que ya creaste se conservan.', 'Desconectar', () => {
            void (async () => { try { await disconnectGmail(); await refresh(); setMessage('Gmail desconectado.'); } catch (e) { setMessage(e instanceof Error ? e.message : 'No se pudo desconectar Gmail.'); } })();
          })} /> : null}
        </View>
        {review.isPending ? <Text variant="caption" tone="secondary">Leyendo y clasificando tu correo… puede tardar un minuto.</Text> : null}
        {message ? <Text variant="caption" tone="secondary" accessibilityLiveRegion="polite">{message}</Text> : null}
      </View>

      {items.length ? (
        <SegmentedControl
          label="Tipo de correo"
          value={view}
          onChange={setView}
          segments={[
            { value: 'pending', label: `Pendientes${pendingCount ? ` (${pendingCount})` : ''}` },
            { value: 'info', label: 'Informativos' },
            { value: 'closed', label: 'Resueltos' },
          ]}
        />
      ) : null}

      {list.isLoading ? <SkeletonList rows={3} /> : null}
      {!list.isLoading && !shown.length ? (
        <EmptyState
          icon={<Inbox size={28} color={colors.accentSoft} strokeWidth={1.6} />}
          title={!items.length ? 'Aún no hay correo revisado' : view === 'pending' ? 'Nada pendiente' : 'Nada por aquí'}
          description={!items.length ? (isConnected ? 'Toca «Revisar correo» para clasificar tus correos recientes.' : 'Conecta Gmail para ver qué tienes pendiente en tu correo.') : view === 'pending' ? 'Ningún correo te pide hacer algo ahora mismo.' : undefined}
        />
      ) : null}
      {shown.map((s) => (
        <SuggestionCard
          key={s.messageId}
          s={s}
          busy={working === s.messageId}
          onTask={() => void act(s, () => suggestionToTask(s), 'Tarea creada.')}
          onStatus={(status) => void act(s, () => setMailStatus(s.messageId, status))}
        />
      ))}
      {view === 'pending' && ignored ? <Text variant="caption" tone="tertiary">{ignored} correos sin importancia ocultos (publicidad y notificaciones automáticas).</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { gap: spacing[3], padding: spacing[3], paddingLeft: spacing[4], borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  card: { gap: spacing[1], padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  urgent: { borderColor: colors.warning },
});

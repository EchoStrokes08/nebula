import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
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
import { gmailThreadUrl, MAIL_KIND_LABEL, MAIL_PROVIDER_LABEL, type MailProvider } from '@/domain/mail/triage';
import { useAuth } from '@/features/auth/session';
import {
  completePendingGmail, connectGmail, connectOutlook, disconnectMail, fetchMailSuggestions, mailConnected, outlookReturn,
  setMailStatus, suggestionToTask, triageMail, type GmailConnectOutcome, type MailSuggestion,
} from '@/features/mail/api';
import { taskKeys } from '@/features/tasks/hooks';
import { confirmAction } from '@/lib/confirm';

type Tab = 'pending' | 'info' | 'closed';
const PROVIDERS: MailProvider[] = ['gmail', 'outlook'];

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });
const dueLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
const openLink = (s: MailSuggestion) => s.provider === 'gmail' ? gmailThreadUrl(s.threadId) : s.webLink ?? 'https://outlook.live.com/mail/';
const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function SuggestionCard({ s, onTask, onStatus, busy }: { s: MailSuggestion; onTask(): void; onStatus(status: 'done' | 'dismissed' | 'new'): void; busy: boolean }) {
  const open = s.status === 'new';
  const actionable = s.kind === 'todo' || s.kind === 'waiting';
  return (
    <View style={[styles.card, open && actionable && s.priority === 1 && styles.urgent]}>
      <Text variant="caption" tone="tertiary">{MAIL_KIND_LABEL[s.kind]} · {s.sender} · {shortDate(s.receivedAt)} · {MAIL_PROVIDER_LABEL[s.provider]}</Text>
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
        <Button label={`Abrir en ${MAIL_PROVIDER_LABEL[s.provider]}`} variant="ghost" onPress={() => void Linking.openURL(openLink(s))} />
      </View>
    </View>
  );
}

/** Correo de Gmail y Outlook clasificado por la IA: qué tienes pendiente, qué esperas y qué es solo informativo. */
export default function Correo() {
  const uid = useAuth((s) => s.session?.user.id);
  const qc = useQueryClient();
  const toast = useToast((t) => t.show);
  const params = useLocalSearchParams<{ outlook?: string }>();
  const [tab, setTab] = useState<Tab>('pending');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ['mail', uid, 'connected'],
    enabled: !!uid,
    retry: 1,
    queryFn: async () => {
      const [gmail, outlook] = await Promise.all(PROVIDERS.map((p) => mailConnected(p).catch(() => false)));
      return { gmail: !!gmail, outlook: !!outlook };
    },
  });
  const list = useQuery({ queryKey: ['mail', uid, 'suggestions'], enabled: !!uid, queryFn: fetchMailSuggestions });
  const refresh = () => qc.invalidateQueries({ queryKey: ['mail', uid] });
  const connected = PROVIDERS.filter((p) => status.data?.[p]);

  const review = useMutation({
    mutationFn: async (only?: MailProvider) => {
      const lines: string[] = [];
      for (const p of only ? [only] : connected) {
        try {
          const r = await triageMail(p);
          lines.push(`${MAIL_PROVIDER_LABEL[p]}: ${r.added ? `${r.added} correos nuevos revisados` : 'nada nuevo'}${r.pending ? ` (quedan ${r.pending} para la próxima revisión)` : ''}.`);
        } catch (e) { lines.push(`${MAIL_PROVIDER_LABEL[p]}: ${errorText(e, 'no se pudo revisar.')}`); }
      }
      return lines.join(' ');
    },
    onMutate: () => setMessage(''),
    onSettled: async (text) => { setMessage(text ?? ''); await refresh(); },
  });

  const afterConnect = async (provider: MailProvider, r: GmailConnectOutcome) => {
    if (r === 'cancelled') { setMessage('Conexión cancelada.'); return; }
    if (r === 'connected') { toast(`${MAIL_PROVIDER_LABEL[provider]} conectado.`); await refresh(); review.mutate(provider); }
  };
  const connect = useMutation({
    mutationFn: async (provider: MailProvider) => ({ provider, r: await (provider === 'gmail' ? connectGmail() : connectOutlook()) }),
    onMutate: () => setMessage(''),
    onSuccess: ({ provider, r }) => afterConnect(provider, r),
    onError: (e) => setMessage(errorText(e, 'No se pudo conectar la cuenta.')),
  });

  // Navegador web: Gmail vuelve por redirección de página completa y Outlook con ?outlook=… en la URL.
  useEffect(() => {
    if (!uid) return;
    const outlook = params.outlook;
    if (outlook) router.setParams({ outlook: undefined });
    void (async () => {
      try { if (await completePendingGmail()) await afterConnect('gmail', 'connected'); }
      catch (e) { setMessage(errorText(e, 'No se pudo conectar Gmail.')); }
      if (!outlook) return;
      try { await afterConnect('outlook', outlookReturn(`?outlook=${outlook}`)); }
      catch (e) { setMessage(errorText(e, 'No se pudo conectar Outlook.')); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const disconnect = (p: MailProvider) => confirmAction(`Desconectar ${MAIL_PROVIDER_LABEL[p]}`, 'Nebula dejará de leer ese correo y borrará sus sugerencias. Las tareas que ya creaste se conservan.', 'Desconectar', () => {
    void (async () => {
      try { await disconnectMail(p); await refresh(); setMessage(`${MAIL_PROVIDER_LABEL[p]} desconectado.`); }
      catch (e) { setMessage(errorText(e, 'No se pudo desconectar.')); }
    })();
  });

  const act = async (s: MailSuggestion, fn: () => Promise<unknown>, done?: string) => {
    setWorking(`${s.provider}:${s.messageId}`);
    try { await fn(); if (done) { toast(done); await qc.invalidateQueries({ queryKey: taskKeys.all(uid) }); } await refresh(); }
    catch (e) { setMessage(errorText(e, 'No se pudo guardar.')); }
    finally { setWorking(null); }
  };

  const items = list.data ?? [];
  const isOpenTask = (s: MailSuggestion) => s.status === 'new' && (s.kind === 'todo' || s.kind === 'waiting');
  const shown = items.filter((s) => tab === 'pending' ? isOpenTask(s) : tab === 'info' ? s.status === 'new' && s.kind === 'info' : s.status !== 'new');
  // Pendientes primero por prioridad y fecha límite; el resto, del más reciente al más antiguo.
  if (tab === 'pending') shown.sort((a, b) => a.priority - b.priority || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const pendingCount = items.filter(isOpenTask).length;
  const ignored = items.filter((s) => s.status === 'new' && s.kind === 'ignore').length;

  return (
    <Screen title="Correo" subtitle="Lo que tienes pendiente en tu correo" back={{ fallback: '/perfil' }}>
      <View style={styles.bar}>
        <View style={styles.row}>
          <Mail size={18} color={colors.info} />
          <Text variant="caption" tone="tertiary" style={styles.flex}>
            Solo lectura: Nebula no envía, borra ni cambia nada en tu correo. Revisa los correos de las últimas dos semanas (sin promociones ni redes sociales) y a la IA solo llegan remitente, asunto y un fragmento.
          </Text>
        </View>
        {PROVIDERS.map((p) => (
          <View key={p} style={styles.account}>
            <View style={styles.flex}>
              <Text variant="bodyStrong">{MAIL_PROVIDER_LABEL[p]}</Text>
              <Text variant="caption" tone="tertiary">{status.isLoading ? 'Comprobando…' : status.data?.[p] ? 'Conectado' : 'Sin conectar'}</Text>
            </View>
            {status.data?.[p]
              ? <Button label="Desconectar" variant="ghost" onPress={() => disconnect(p)} />
              : <Button label="Conectar" variant="secondary" disabled={status.isLoading} loading={connect.isPending && connect.variables === p} onPress={() => connect.mutate(p)} />}
          </View>
        ))}
        {connected.length ? <Button label="Revisar correo" loading={review.isPending} onPress={() => review.mutate(undefined)} /> : null}
        {review.isPending ? <Text variant="caption" tone="secondary">Leyendo y clasificando tu correo… puede tardar un minuto.</Text> : null}
        {message ? <Text variant="caption" tone="secondary" accessibilityLiveRegion="polite">{message}</Text> : null}
      </View>

      {items.length ? (
        <SegmentedControl
          label="Tipo de correo"
          value={tab}
          onChange={setTab}
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
          title={!items.length ? 'Aún no hay correo revisado' : tab === 'pending' ? 'Nada pendiente' : 'Nada por aquí'}
          description={!items.length ? (connected.length ? 'Toca «Revisar correo» para clasificar tus correos recientes.' : 'Conecta Gmail u Outlook para ver qué tienes pendiente en tu correo.') : tab === 'pending' ? 'Ningún correo te pide hacer algo ahora mismo.' : undefined}
        />
      ) : null}
      {shown.map((s) => (
        <SuggestionCard
          key={`${s.provider}:${s.messageId}`}
          s={s}
          busy={working === `${s.provider}:${s.messageId}`}
          onTask={() => void act(s, () => suggestionToTask(s), 'Tarea creada.')}
          onStatus={(next) => void act(s, () => setMailStatus(s, next))}
        />
      ))}
      {tab === 'pending' && ignored ? <Text variant="caption" tone="tertiary">{ignored} correos sin importancia ocultos (publicidad y notificaciones automáticas).</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { gap: spacing[3], padding: spacing[3], paddingLeft: spacing[4], borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  account: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: colors.border },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  card: { gap: spacing[1], padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  urgent: { borderColor: colors.warning },
});

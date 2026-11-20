import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Ban, Check, Swords, UserMinus, UserPlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SearchField } from '@/components/forms/SearchField';
import { Screen } from '@/components/layout/Screen';
import { useToast } from '@/components/overlays/UndoToast';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { Avatar } from '@/components/social/Avatar';
import { colors, radius, spacing } from '@/design/tokens';
import { confirmAction } from '@/lib/confirm';
import * as api from '@/features/social/api';
import { socialError, useBlocked, useFriendRequests, useFriends, useSocialMutation } from '@/features/social/hooks';
import { SkeletonList } from '@/components/feedback/Skeleton';

export default function Amigos() {
  const [q, setQ] = useState('');
  const term = q.trim();
  const search = useQuery({ queryKey: ['search', term], queryFn: () => api.searchProfiles(term), enabled: term.replace('@', '').length >= 2, staleTime: 10_000 });
  const friends = useFriends();
  const requests = useFriendRequests();
  const blocked = useBlocked();
  const toast = useToast((t) => t.show);
  const act = useSocialMutation(async (fn: () => Promise<unknown>) => fn());
  const run = (fn: () => Promise<unknown>, ok?: string) => act.mutate(fn, { onSuccess: () => ok && toast(ok), onError: (e) => toast(socialError(e)) });
  const incoming = (requests.data ?? []).filter((r) => r.direction === 'incoming');
  const outgoing = (requests.data ?? []).filter((r) => r.direction === 'outgoing');

  return (
    <Screen back={{ fallback: '/retos' }} title="Amigos">
      <SearchField label="Buscar amigos por @usuario o nombre" value={q} onChangeText={setQ} autoCapitalize="none" autoCorrect={false} placeholder="Busca por @usuario o nombre" />
      {term.length >= 2 ? (
        <View style={styles.card}>
          {search.isLoading ? <Text tone="secondary">Buscando…</Text> : null}
          {search.data?.length === 0 ? <Text tone="secondary">Nadie con ese nombre. Los perfiles privados solo aparecen con su @usuario exacto.</Text> : null}
          {search.data?.map((p) => (
            <View key={p.id} style={styles.person}>
              <Avatar name={p.displayName} seed={p.handle} />
              <View style={styles.flex}>
                <Text variant="bodyStrong">{p.displayName}</Text>
                <Text variant="caption" tone="secondary">@{p.handle}</Text>
              </View>
              {p.relation === 'friend' ? <Text variant="caption" tone="success">Amigos</Text> : null}
              {p.relation === 'requested' ? <Text variant="caption" tone="tertiary">Solicitud enviada</Text> : null}
              {p.relation === 'none' || p.relation === 'incoming' ? (
                <Button label={p.relation === 'incoming' ? 'Aceptar' : 'Añadir'} variant="secondary" icon={<UserPlus size={16} color={colors.text} />} onPress={() => run(() => api.sendFriendRequest(p.id), p.relation === 'incoming' ? 'Ahora sois amigos' : 'Solicitud enviada')} />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {incoming.length ? (
        <View style={styles.card}>
          <Text variant="title3">Solicitudes recibidas</Text>
          {incoming.map((r) => (
            <View key={r.id} style={styles.person}>
              <Avatar name={r.displayName} seed={r.handle} />
              <View style={styles.flex}>
                <Text variant="bodyStrong">{r.displayName}</Text>
                <Text variant="caption" tone="secondary">@{r.handle}</Text>
              </View>
              <Pressable onPress={() => run(() => api.respondFriendRequest(r.id, false))} accessibilityRole="button" accessibilityLabel={`Rechazar a ${r.displayName}`} style={styles.iconBtn}><X size={20} color={colors.textSecondary} /></Pressable>
              <Pressable onPress={() => run(() => api.respondFriendRequest(r.id, true), 'Ahora sois amigos')} accessibilityRole="button" accessibilityLabel={`Aceptar a ${r.displayName}`} style={[styles.iconBtn, styles.accept]}><Check size={20} color={colors.textOnAccent} /></Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {outgoing.length ? (
        <View style={styles.card}>
          <Text variant="title3">Enviadas</Text>
          {outgoing.map((r) => (
            <View key={r.id} style={styles.person}>
              <Avatar name={r.displayName} seed={r.handle} />
              <Text style={styles.flex}>{r.displayName} <Text variant="caption" tone="secondary">@{r.handle}</Text></Text>
              <Button label="Cancelar" variant="ghost" onPress={() => run(() => api.cancelFriendRequest(r.id))} />
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text variant="title3">Tus amigos</Text>
        {friends.isLoading ? <SkeletonList rows={3} /> : null}
        {friends.data?.length === 0 ? <Text tone="secondary">Aún no tienes amigos en Nebula. Búscalos por su @usuario.</Text> : null}
        {friends.data?.map((f) => (
          <View key={f.id} style={styles.person}>
            <Avatar name={f.displayName} seed={f.handle} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{f.displayName}</Text>
              <Text variant="caption" tone="secondary">@{f.handle}</Text>
            </View>
            <Pressable onPress={() => router.push({ pathname: '/reto/nuevo', params: { amigo: f.id } })} accessibilityRole="button" accessibilityLabel={`Retar a ${f.displayName}`} style={styles.iconBtn}><Swords size={18} color={colors.accentSoft} /></Pressable>
            <Pressable onPress={() => confirmAction('Eliminar amistad', `${f.displayName} dejará de ser tu amigo. Los retos compartidos se conservan.`, 'Eliminar', () => run(() => api.removeFriend(f.id)))} accessibilityRole="button" accessibilityLabel={`Eliminar a ${f.displayName}`} style={styles.iconBtn}><UserMinus size={18} color={colors.textTertiary} /></Pressable>
            <Pressable onPress={() => confirmAction('Bloquear', `${f.displayName} no podrá encontrarte ni enviarte solicitudes. Se eliminará la amistad.`, 'Bloquear', () => run(() => api.blockUser(f.id), 'Usuario bloqueado'))} accessibilityRole="button" accessibilityLabel={`Bloquear a ${f.displayName}`} style={styles.iconBtn}><Ban size={18} color={colors.textTertiary} /></Pressable>
          </View>
        ))}
      </View>

      {blocked.data?.length ? (
        <View style={styles.card}>
          <Text variant="title3">Bloqueados</Text>
          {blocked.data.map((b) => (
            <View key={b.id} style={styles.person}>
              <Text style={styles.flex}>{b.displayName} <Text variant="caption" tone="secondary">@{b.handle}</Text></Text>
              <Button label="Desbloquear" variant="ghost" onPress={() => run(() => api.unblockUser(b.id))} />
            </View>
          ))}
        </View>
      ) : null}
      <Text variant="caption" tone="tertiary">Tu correo nunca es visible. Los demás solo ven tu nombre y tu @usuario, y lo que decidas compartir.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: spacing[3], padding: spacing[5], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  accept: { backgroundColor: colors.accent },
});

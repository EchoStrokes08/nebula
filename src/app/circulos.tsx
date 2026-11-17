import { router } from 'expo-router';
import { Check, ChevronRight, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { Sheet } from '@/components/overlays/Sheet';
import { useToast } from '@/components/overlays/UndoToast';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import * as api from '@/features/social/api';
import { socialError, useCircleInvites, useCircles, useSocialMutation } from '@/features/social/hooks';
import { SkeletonList } from '@/components/feedback/Skeleton';

export default function Circulos() {
  const circles = useCircles();
  const invites = useCircleInvites();
  const toast = useToast((t) => t.show);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const act = useSocialMutation(async (fn: () => Promise<unknown>) => fn());

  return (
    <Screen back={{ fallback: '/retos' }} title="Círculos" trailing={<Button label="Nuevo" icon={<Plus size={18} color={colors.textOnAccent} />} onPress={() => setOpen(true)} />}>
      <Text tone="secondary">Grupos privados de amigos para retos y objetivos compartidos.</Text>
      {invites.data?.map((i) => (
        <View key={i.id} style={[styles.card, styles.invite]}>
          <Text variant="bodyStrong" style={styles.flex}>Invitación a «{i.circleName}»</Text>
          <Pressable onPress={() => act.mutate(() => api.respondCircleInvite(i.id, false))} accessibilityRole="button" accessibilityLabel="Rechazar" style={styles.iconBtn}><X size={20} color={colors.textSecondary} /></Pressable>
          <Pressable onPress={() => act.mutate(() => api.respondCircleInvite(i.id, true), { onSuccess: () => toast('Te has unido al círculo') })} accessibilityRole="button" accessibilityLabel="Aceptar" style={[styles.iconBtn, styles.accept]}><Check size={20} color={colors.textOnAccent} /></Pressable>
        </View>
      ))}
      {circles.isLoading ? <SkeletonList rows={3} /> : null}
      {circles.data?.length === 0 ? <Text tone="secondary">Aún no perteneces a ningún círculo.</Text> : null}
      {circles.data?.map((c) => (
        <Pressable key={c.id} onPress={() => router.push({ pathname: '/circulo/[id]', params: { id: c.id } })} style={({ pressed }) => [styles.card, pressed && styles.pressed]} accessibilityRole="button">
          <View style={styles.flex}>
            <Text variant="title3">{c.name}</Text>
            {c.description ? <Text variant="callout" tone="secondary">{c.description}</Text> : null}
          </View>
          <ChevronRight size={18} color={colors.textTertiary} />
        </Pressable>
      ))}
      <Sheet visible={open} onClose={() => setOpen(false)} title="Nuevo círculo">
        <TextField label="Nombre" value={name} onChangeText={setName} maxLength={60} placeholder="Grupo de estudio" />
        <TextField label="Descripción (opcional)" value={desc} onChangeText={setDesc} maxLength={300} />
        <View style={styles.actions}>
          <Button label="Cancelar" variant="ghost" onPress={() => setOpen(false)} />
          <Button
            label="Crear"
            disabled={!name.trim()}
            loading={act.isPending}
            onPress={() =>
              act.mutate(() => api.createCircle(name.trim(), desc.trim() || null), {
                onSuccess: (id) => {
                  setOpen(false);
                  setName('');
                  setDesc('');
                  router.push({ pathname: '/circulo/[id]', params: { id: id as string } });
                },
                onError: (e) => toast(socialError(e)),
              })
            }
          />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[5], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  invite: { borderColor: colors.warning },
  pressed: { backgroundColor: colors.surfacePressed },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  accept: { backgroundColor: colors.accent },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2] },
});

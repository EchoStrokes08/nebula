import { router } from 'expo-router';
import { BarChart3, CalendarClock, ChevronRight, ClipboardCheck, Flag, LogOut, UserRound, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/session';
import { useMyProfile } from '@/features/profile/useMyProfile';

export default function PerfilScreen() {
  const session = useAuth((s) => s.session);
  const profile = useMyProfile();
  const [busy, setBusy] = useState(false);

  return (
    <Screen title="Perfil">
      {session ? (
        <View style={styles.card}>
          <View style={styles.avatar}>
            <UserRound size={26} color={colors.accentSoft} strokeWidth={1.6} />
          </View>
          <View style={styles.flex}>
            <Text variant="title3">{profile.data?.display_name ?? ' '}</Text>
            <Text variant="callout" tone="secondary">
              {profile.data ? `@${profile.data.handle}` : profile.isError ? 'No se pudo cargar el perfil' : 'Cargando…'}
            </Text>
          </View>
        </View>
      ) : (
        <EmptyState
          icon={<UserRound size={28} color={colors.accentSoft} strokeWidth={1.6} />}
          title="Tu perfil"
          description="Estadísticas, metas, preferencias y privacidad."
        />
      )}
      {session ? (
        <View style={styles.menu}>
          <MenuItem icon={BarChart3} label="Estadísticas" hint="Tu evolución, tu perfil de productividad y el radar" href="/estadisticas" />
          <MenuItem icon={Flag} label="Metas y proyectos" hint="Lo que estás construyendo" href="/metas" />
          <MenuItem icon={ClipboardCheck} label="Revisión de compromisos" hint="Lo prometido frente a lo hecho" href="/revision" />
          <MenuItem icon={CalendarClock} label="Disponibilidad" hint="Cuándo puede planificar Nebula" href="/disponibilidad" />
        </View>
      ) : null}
      {session ? <>
        <Button label="Nota rápida" onPress={() => router.push('/captura')} />
        <Button label="Asistente y recomendaciones" variant="secondary" onPress={() => router.push('/asistente')} />
        <Button label="Diario y revisión semanal" variant="secondary" onPress={() => router.push('/diario')} />
        <Button label="Mapa de progreso" variant="secondary" onPress={() => router.push('/constelacion')} />
        <Button label="Enfoque con amigos" variant="secondary" onPress={() => router.push('/salas')} />
        <Button label="Integraciones" variant="secondary" onPress={() => router.push('/integraciones')} />
      </> : null}
      {session ? <Button label="Configuración y privacidad" variant="secondary" onPress={() => router.push('/configuracion')} /> : null}
      {session ? (
        <Button
          label="Cerrar sesión"
          variant="secondary"
          icon={<LogOut size={18} color={colors.text} />}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            await signOut().catch(() => setBusy(false));
          }}
        />
      ) : null}
    </Screen>
  );
}

function MenuItem({ icon: Icon, label, hint, href }: { icon: LucideIcon; label: string; hint: string; href: '/estadisticas' | '/metas' | '/revision' | '/disponibilidad' }) {
  return (
    <Pressable onPress={() => router.push(href)} accessibilityRole="button" accessibilityLabel={`${label}. ${hint}`} style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}>
      <Icon size={20} color={colors.accentSoft} />
      <View style={styles.flex}>
        <Text variant="bodyStrong">{label}</Text>
        <Text variant="caption" tone="secondary">{hint}</Text>
      </View>
      <ChevronRight size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  menu: { borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], padding: spacing[4], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemPressed: { backgroundColor: colors.surfacePressed },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    padding: spacing[5],
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
  },
  flex: { flex: 1, gap: 2 },
});

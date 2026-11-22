import { router, type Href } from 'expo-router';
import { BarChart3, BookOpen, CalendarClock, CalendarSync, ChevronRight, ClipboardCheck, Flag, LogOut, Mail, Settings, Sparkle, Sparkles, StickyNote, UserRound, Users, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Screen } from '@/components/layout/Screen';
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
        <>
          <Section title="TU PROGRESO">
            <MenuItem icon={BarChart3} label="Estadísticas" hint="Tu evolución, tu perfil de productividad y el radar" href="/estadisticas" />
            <MenuItem icon={Flag} label="Metas y proyectos" hint="Lo que estás construyendo" href="/metas" />
            <MenuItem icon={ClipboardCheck} label="Revisión de compromisos" hint="Lo prometido frente a lo hecho" href="/revision" />
            <MenuItem icon={BookOpen} label="Diario y revisión semanal" hint="Cómo te fue y qué ajustar" href="/diario" />
            <MenuItem icon={Sparkle} label="Mapa de progreso" hint="Tu constelación de logros" href="/constelacion" />
          </Section>
          <Section title="HERRAMIENTAS">
            <MenuItem icon={Sparkles} label="Asistente y recomendaciones" hint="Pregúntale a Nebula por tu día o tus metas" href="/asistente" />
            <MenuItem icon={StickyNote} label="Nota rápida" hint="Apunta algo antes de que se te olvide" href="/captura" />
            <MenuItem icon={Users} label="Enfoque con amigos" hint="Salas para concentrarse juntos" href="/salas" />
            <MenuItem icon={CalendarClock} label="Disponibilidad" hint="Cuándo puede planificar Nebula" href="/disponibilidad" />
            <MenuItem icon={Mail} label="Correo" hint="Qué tienes pendiente en Gmail" href="/correo" />
            <MenuItem icon={CalendarSync} label="Integraciones" hint="Google Calendar y otros calendarios" href="/integraciones" />
          </Section>
          <Section title="CUENTA">
            <MenuItem icon={Settings} label="Configuración y privacidad" hint="Perfil, notificaciones, calendario y apariencia" href="/configuracion" />
            <Pressable
              onPress={async () => { setBusy(true); await signOut().catch(() => setBusy(false)); }}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Cerrar sesión"
              style={({ pressed }) => [styles.item, styles.last, pressed && styles.itemPressed]}
            >
              <LogOut size={20} color={colors.danger} />
              <Text variant="bodyStrong" style={[styles.flex, { color: colors.danger }]}>{busy ? 'Cerrando sesión…' : 'Cerrar sesión'}</Text>
            </Pressable>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="overline" tone="accent">{title}</Text>
      <View style={styles.menu}>{children}</View>
    </View>
  );
}

function MenuItem({ icon: Icon, label, hint, href }: { icon: LucideIcon; label: string; hint: string; href: Href }) {
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
  last: { borderBottomWidth: 0 },
  section: { gap: spacing[2] },
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

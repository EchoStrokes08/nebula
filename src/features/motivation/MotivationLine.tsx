import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { chooseMessage, type MotivationContext } from '@/domain/motivation/engine';
import { useToday } from '@/features/habits/useToday';

import { useRecentMessages } from './recent';
import { useMotivationContext } from './useMotivationContext';

/** Mensaje contextual del día (Hoy, antes de enfocarse, cierre). Estable durante el día. */
/** `extra` añade hechos reales del contexto concreto (p. ej. la posición en un reto). */
export function MotivationLine({ moment, extra }: { moment: MotivationContext['moment']; extra?: Partial<MotivationContext> }) {
  const base = useMotivationContext(moment);
  const ctx = base ? { ...base, ...extra } : null;
  const recent = useRecentMessages((s) => s.recent);
  const remember = useRecentMessages((s) => s.remember);
  const today = useToday();
  // Semilla estable por día y momento: el mensaje no cambia en cada render.
  const day = [...today].reduce((a, c) => a + c.charCodeAt(0), 0);
  // Los recientes excluyen el elegido hoy para que el mensaje no cambie al volver a la pantalla.
  const chosen = ctx ? chooseMessage({ ...ctx, recent: recent.slice(1) }, day + moment.length) : null;
  useEffect(() => {
    if (chosen) remember(chosen.id);
  }, [chosen?.id, remember]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!chosen) return null;
  return (
    <View style={styles.root} accessibilityRole="text">
      <View style={styles.bar} />
      <Text variant="bodyStrong" style={styles.text}>
        {chosen.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', gap: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md },
  bar: { width: 3, borderRadius: 2, backgroundColor: colors.accentBright },
  text: { flex: 1, color: colors.accentSoft },
});

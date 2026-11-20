import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { chooseMessage, type MotivationContext } from '@/domain/motivation/engine';
import { useToday } from '@/features/habits/useToday';

import { PhraseHero } from './PhraseHero';
import { useRecentMessages } from './recent';
import { useMotivationContext } from './useMotivationContext';

/** Mensaje contextual del día (Hoy, antes de enfocarse, cierre). Estable durante el día. */
/** `extra` añade hechos reales del contexto concreto (p. ej. la posición en un reto). `hero` lo muestra en grande (Hoy). */
export function MotivationLine({ moment, extra, hero }: { moment: MotivationContext['moment']; extra?: Partial<MotivationContext>; hero?: boolean }) {
  const base = useMotivationContext(moment);
  const ctx = base ? { ...base, ...extra } : null;
  const today = useToday();
  const key = `${today}:${moment}`;
  const pinned = useRecentMessages((s) => s.picks[key]);
  const remember = useRecentMessages((s) => s.remember);
  const pin = useRecentMessages((s) => s.pin);
  // Los recientes se leen una sola vez al montar: si otra línea (p. ej. Hoy detrás de Enfoque)
  // guarda su mensaje, esta no vuelve a elegir. Antes se realimentaban en un bucle infinito.
  const [recentAtMount] = useState(() => useRecentMessages.getState().recent);
  // Semilla estable por día y momento: el mensaje no cambia en cada render.
  const day = [...today].reduce((a, c) => a + c.charCodeAt(0), 0);
  const chosen = ctx ? chooseMessage({ ...ctx, recent: recentAtMount.filter((id) => id !== pinned), prefer: pinned }, day + moment.length) : null;
  useEffect(() => {
    if (!chosen || chosen.id === pinned) return;
    pin(key, chosen.id);
    remember(chosen.id);
  }, [chosen?.id, pinned, key, pin, remember]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!chosen) return null;
  if (hero) return <PhraseHero label={moment === 'cierre' ? 'PARA CERRAR EL DÍA' : 'FRASE DE HOY'} text={chosen.text} />;
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

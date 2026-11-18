import AsyncStorage from '@react-native-async-storage/async-storage';
import { Download } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { getDesktopBridge } from '@/platform/desktopBridge';
import { checkForUpdate, installUpdate, type UpdateOffer } from './update';

const DISMISSED_KEY = 'nebula.update.dismissed';
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/** Aviso de versión nueva con botón «Actualizar» (Android y escritorio). */
export function UpdateBanner() {
  const [offer, setOffer] = useState<UpdateOffer | null>(null);
  const [state, setState] = useState<'idle' | 'working' | 'waiting' | 'error'>('idle');

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const found = await checkForUpdate();
      const dismissed = await AsyncStorage.getItem(DISMISSED_KEY).catch(() => null);
      if (alive) setOffer(found && found.latest !== dismissed ? found : null);
    };
    void check();
    const timer = setInterval(() => void check(), CHECK_EVERY_MS);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  if (!offer) return null;
  const desktop = !!getDesktopBridge();
  const update = async () => {
    setState('working');
    const r = await installUpdate();
    // En Android el instalador del sistema toma el control; en Linux la app se reinicia sola.
    setState(r === 'error' ? 'error' : 'waiting');
  };
  const later = () => { void AsyncStorage.setItem(DISMISSED_KEY, offer.latest).catch(() => undefined); setOffer(null); };

  return (
    <View style={styles.root} accessibilityLiveRegion="polite">
      <View style={styles.row}>
        <Download size={18} color={colors.success} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">Nebula {offer.latest} disponible</Text>
          <Text variant="caption" tone="secondary">
            {state === 'working' ? (desktop ? 'Descargando la nueva versión… la app se reiniciará sola.' : 'Descargando la nueva versión…')
              : state === 'waiting' ? (desktop ? 'Instalando…' : 'Confirma «Actualizar» en el instalador de Android. Tus datos se conservan.')
              : state === 'error' ? 'No se pudo actualizar. Reintenta o descárgala desde la web.'
              : offer.notes || `Tienes la ${offer.current}. Actualiza para tener las últimas mejoras.`}
          </Text>
        </View>
      </View>
      {state === 'working' ? null : (
        <View style={styles.row}>
          <Button label={state === 'waiting' && !desktop ? 'Abrir instalador otra vez' : state === 'error' ? 'Reintentar' : 'Actualizar'} onPress={() => void update()} />
          {state === 'idle' ? <Button label="Más tarde" variant="ghost" onPress={later} /> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { margin: spacing[3], padding: spacing[3], gap: spacing[2], borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(111, 214, 160, 0.35)', backgroundColor: colors.successMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flexWrap: 'wrap' },
  flex: { flex: 1, gap: 2 },
});

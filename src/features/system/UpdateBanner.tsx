import AsyncStorage from '@react-native-async-storage/async-storage';
import { Download } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { getDesktopBridge } from '@/platform/desktopBridge';
import {
  canInstallSilently, checkForUpdate, downloadApk, installApk, installUpdate, isMeteredConnection, onInstallStatus, type UpdateOffer,
} from './update';
import { updateCopy, type UpdatePhase } from './updateCopy';

const DISMISSED_KEY = 'nebula.update.dismissed';
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/**
 * Actualizaciones automáticas (Android y escritorio). Al detectar una versión nueva la descarga en
 * segundo plano y la instala sola:
 * - Android 12+: cuando sales de Nebula, sin diálogos (la primera vez con el instalador nuevo se confirma
 *   una vez). Con datos móviles espera a que pulses «Actualizar».
 * - Linux: sustituye el AppImage; la próxima vez que abras Nebula ya es la versión nueva.
 * - Windows: se instala en silencio al cerrar Nebula.
 * «Ocultar» solo esconde el aviso: la instalación automática sigue su curso.
 */
export function UpdateBanner() {
  const [offer, setOffer] = useState<UpdateOffer | null>(null);
  const [phase, setPhase] = useState<UpdatePhase>('available');
  const [hidden, setHidden] = useState(false);
  const apk = useRef<string | null>(null);
  const busy = useRef(false);
  const desktop = getDesktopBridge();
  const platform = desktop ? (desktop.platform === 'win32' ? 'windows' : 'linux') : 'android';

  // Busca versiones nuevas al abrir y cada 6 h, y prepara la descarga sin esperar a nadie.
  useEffect(() => {
    let alive = true;
    const prepare = async (found: UpdateOffer) => {
      if (busy.current) return;
      busy.current = true;
      try {
        if (desktop?.update) {
          const info = await desktop.update.check().catch(() => null);
          if (!info?.auto || !desktop.update.prepare) return;
          if (alive) setPhase('downloading');
          const r = await desktop.update.prepare().catch(() => ({ status: 'error' as const }));
          if (alive) setPhase(r.status === 'ready' ? 'ready' : 'available');
          return;
        }
        if (await isMeteredConnection()) return;
        if (alive) setPhase('downloading');
        apk.current = await downloadApk(found.latest);
        if (alive) setPhase((await canInstallSilently()) ? 'readySilent' : 'readyConfirm');
      } catch {
        if (alive) setPhase('available');
      } finally { busy.current = false; }
    };
    const check = async () => {
      const found = await checkForUpdate();
      if (!alive || !found) return;
      const dismissed = await AsyncStorage.getItem(DISMISSED_KEY).catch(() => null);
      setOffer((prev) => (prev?.latest === found.latest ? prev : found));
      setHidden(found.latest === dismissed);
      void prepare(found);
    };
    void check();
    const timer = setInterval(() => void check(), CHECK_EVERY_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [desktop]);

  // Android: el resultado de la instalación nativa; si falla, se recurre al instalador del sistema.
  useEffect(() => {
    let stop: (() => void) | undefined;
    let alive = true;
    void onInstallStatus((status) => {
      if (status === 'pendingUserAction') setPhase('confirming');
      else if (status === 'aborted') setPhase('readyConfirm');
      else if (status === 'failure') {
        setPhase('confirming');
        if (apk.current) installApk(apk.current, { fallback: true }).catch(() => setPhase('error'));
      }
    }).then((s) => { if (alive) stop = s; else s(); });
    return () => { alive = false; stop?.(); };
  }, []);

  // Android 12+: se instala sola al salir de la app (el sistema cierra Nebula y la deja actualizada).
  useEffect(() => {
    if (phase !== 'readySilent') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && apk.current) {
        setPhase('installing');
        installApk(apk.current).catch(() => setPhase('readyConfirm'));
      }
    });
    return () => sub.remove();
  }, [phase]);

  if (!offer || hidden) return null;

  const act = async () => {
    if (apk.current && (phase === 'readySilent' || phase === 'readyConfirm' || phase === 'confirming' || phase === 'error')) {
      setPhase('installing');
      return installApk(apk.current).catch(() => setPhase('error'));
    }
    setPhase('installing');
    const r = await installUpdate(offer.latest);
    // Android: el instalador del sistema toma el control. Escritorio: la app se reinicia sola.
    setPhase(r === 'error' ? 'error' : r === 'opened' ? 'available' : desktop ? 'installing' : 'confirming');
  };
  const hide = () => { void AsyncStorage.setItem(DISMISSED_KEY, offer.latest).catch(() => undefined); setHidden(true); };
  const copy = updateCopy(phase, platform, offer);

  return (
    <View style={styles.root} accessibilityLiveRegion="polite">
      <View style={styles.row}>
        <Download size={18} color={colors.success} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">Nebula {offer.latest} {copy.title}</Text>
          <Text variant="caption" tone="secondary">{copy.body}</Text>
        </View>
      </View>
      {copy.action || copy.canHide ? (
        <View style={styles.row}>
          {copy.action ? <Button label={copy.action} onPress={() => void act()} /> : null}
          {copy.canHide ? <Button label={copy.hideLabel} variant="ghost" onPress={hide} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { margin: spacing[3], padding: spacing[3], gap: spacing[2], borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(111, 214, 160, 0.35)', backgroundColor: colors.successMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], flexWrap: 'wrap' },
  flex: { flex: 1, gap: 2 },
});

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Switch } from '@/components/forms/Switch';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { spacing } from '@/design/tokens';
import { getDesktopBridge } from '@/platform/desktopBridge';

/** Ajustes propios del escritorio: bandeja, inicio con el sistema y atajo global de captura. */
export function DesktopSettings() {
  const bridge = getDesktopBridge();
  const [error, setError] = useState('');
  const [shortcut, setShortcut] = useState<string | null>(null);
  const settings = useQuery({ queryKey: ['desktop_settings'], enabled: !!bridge, queryFn: () => bridge!.settings.get() });
  if (!bridge) return null;
  async function update(patch: { minimizeToTray?: boolean; startWithSystem?: boolean; globalShortcut?: string }) {
    try { await bridge!.settings.set(patch); await settings.refetch(); setError(''); setShortcut(null); } catch (e) { setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : 'No se pudo guardar.'); }
  }
  const data = settings.data;
  return (
    <View style={styles.root}>
      <Text variant="title2">Escritorio</Text>
      {data?.trayAvailable ? <Switch label="Mantener en la bandeja al cerrar" description="Los recordatorios siguen llegando con la ventana cerrada." value={data.minimizeToTray} onChange={(v) => void update({ minimizeToTray: v })} /> : null}
      {data?.canStartWithSystem ? (
        <Switch label="Iniciar con el sistema" description="Arranca en segundo plano al iniciar sesión." value={data.startWithSystem} onChange={(v) => void update({ startWithSystem: v })} />
      ) : <Text variant="caption" tone="secondary">El inicio automático está disponible en la app instalada.</Text>}
      {data ? (
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Atajo global de captura rápida" value={shortcut ?? data.globalShortcut} onChangeText={setShortcut} hint="Funciona aunque Nebula no tenga el foco. Vacío lo desactiva. Ejemplo: CommandOrControl+Alt+N" autoCapitalize="none" />
          </View>
          {shortcut !== null && shortcut !== data.globalShortcut ? <Button label="Guardar" variant="secondary" onPress={() => void update({ globalShortcut: shortcut })} /> : null}
        </View>
      ) : null}
      {error ? <Text tone="danger" accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[3] },
  flex: { flex: 1 },
});

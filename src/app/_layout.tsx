import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { Sora_300Light } from '@expo-google-fonts/sora/300Light';
import { Sora_600SemiBold } from '@expo-google-fonts/sora/600SemiBold';
import { Sora_700Bold } from '@expo-google-fonts/sora/700Bold';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif/400Regular';
import { InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif/400Regular_Italic';
import { useFonts } from 'expo-font';
import { QueryClientProvider } from '@tanstack/react-query';
import { router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SpaceBackground } from '@/components/primitives/SpaceBackground';
import { queryClient } from '@/data/queryClient';
import { startOfflineRuntime } from '@/data/offline/runtime';
import { OfflineBanner } from '@/components/feedback/OfflineBanner';
import { navigationTheme } from '@/design/navigationTheme';
import { colors } from '@/design/tokens';
import { startAuthListener, useAuth } from '@/features/auth/session';
import { ConfigRequired } from '@/features/system/ConfigRequired';
import { resolveGate } from '@/features/system/gate';
import { PreviewBadge } from '@/features/system/PreviewBadge';
import { UpdateBanner } from '@/features/system/UpdateBanner';
import { WidgetSync } from '@/features/widget/WidgetSync';
import { FocusAmbience } from '@/features/focus/FocusAmbience';
import { UndoToast } from '@/components/overlays/UndoToast';
import { ConfirmHost } from '@/components/overlays/ConfirmHost';
import { clientEnv } from '@/lib/env';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { notifications } from '@/platform/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});
startAuthListener();

export default function RootLayout() {
  const reducedMotion = useReducedMotion();
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold,
    Sora_300Light, Sora_600SemiBold, Sora_700Bold,
    InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic,
  });
  const status = useAuth((s) => s.status);
  const onboarded = useAuth((s) => s.onboarded);
  const recovery = useAuth((s) => s.recovery);
  const gate = resolveGate(clientEnv, { status, onboarded, recovery });
  const ready = (fontsLoaded || !!fontError) && gate !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useEffect(() => startOfflineRuntime(), []);

  // Escritorio: Esc cierra la pantalla modal actual (captura, editores…) si no hay un diálogo abierto.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[aria-modal="true"]')) return; // lo cierra el propio diálogo
      if (router.canGoBack()) { e.preventDefault(); router.back(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    notifications.setOpenHandler((route) => router.push(route as never));
    notifications.init().catch(() => {});
  }, []);

  if (!ready) return <View style={styles.root} />;

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navigationTheme}>
          <View style={styles.root}>
            <SpaceBackground />
            <StatusBar style="light" />
            <OfflineBanner />
            <UpdateBanner />
            <WidgetSync />
            <FocusAmbience />
            {gate === 'config' ? (
              <ConfigRequired missing={clientEnv.ok ? [] : clientEnv.missing} />
            ) : (
              <Stack screenOptions={{ headerShown: false, contentStyle: styles.transparent, animation: reducedMotion ? 'none' : 'fade' }}>
                <Stack.Protected guard={gate === 'app' || gate === 'preview'}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="habito/nuevo" options={{ presentation: 'modal', animation: reducedMotion ? 'none' : 'slide_from_bottom' }} />
                  <Stack.Screen name="habito/[id]" options={{ animation: reducedMotion ? 'none' : 'slide_from_right' }} />
                  <Stack.Screen name="habito/editar/[id]" options={{ presentation: 'modal', animation: reducedMotion ? 'none' : 'slide_from_bottom' }} />
                  <Stack.Screen name="tarea/nueva" options={{ presentation: 'modal', animation: reducedMotion ? 'none' : 'slide_from_bottom' }} />
                  <Stack.Screen name="tarea/[id]" options={{ animation: reducedMotion ? 'none' : 'slide_from_right' }} />
                  <Stack.Screen name="tarea/editar/[id]" options={{ presentation: 'modal', animation: reducedMotion ? 'none' : 'slide_from_bottom' }} />
                  <Stack.Screen name="metas" options={{ animation: reducedMotion ? 'none' : 'slide_from_right' }} />
                  <Stack.Screen name="meta/nueva" options={{ presentation: 'modal', animation: reducedMotion ? 'none' : 'slide_from_bottom' }} />
                  <Stack.Screen name="meta/[id]" options={{ animation: reducedMotion ? 'none' : 'slide_from_right' }} />
                  <Stack.Screen name="meta/editar/[id]" options={{ presentation: 'modal', animation: reducedMotion ? 'none' : 'slide_from_bottom' }} />
                  <Stack.Screen name="simulador" options={{ animation: reducedMotion ? 'none' : 'slide_from_right' }} />
                  <Stack.Screen name="evento/nuevo" options={{ presentation: 'modal', animation: reducedMotion ? 'none' : 'slide_from_bottom' }} />
                  <Stack.Screen name="evento/[id]" options={{ presentation: 'modal', animation: reducedMotion ? 'none' : 'slide_from_bottom' }} />
                  <Stack.Screen name="planificar" options={{ animation: reducedMotion ? 'none' : 'slide_from_right' }} />
                  <Stack.Screen name="disponibilidad" options={{ animation: reducedMotion ? 'none' : 'slide_from_right' }} />
                  <Stack.Screen name="enfoque" options={{ animation: reducedMotion ? 'none' : 'fade' }} />
                  <Stack.Screen name="estadisticas" options={{ animation: reducedMotion ? 'none' : 'slide_from_right' }} />
                  <Stack.Screen name="resumen" options={{ animation: reducedMotion ? 'none' : 'slide_from_right' }} />
                  <Stack.Screen name="revision" options={{ animation: reducedMotion ? 'none' : 'slide_from_right' }} />
                  <Stack.Screen name="amigos" options={{ animation: reducedMotion ? 'none' : 'slide_from_right' }} />
                  <Stack.Screen name="circulos" options={{ animation: reducedMotion ? 'none' : 'slide_from_right' }} />
                  <Stack.Screen name="circulo/[id]" options={{ animation: reducedMotion ? 'none' : 'slide_from_right' }} />
                  <Stack.Screen name="reto/nuevo" options={{ presentation: 'modal', animation: reducedMotion ? 'none' : 'slide_from_bottom' }} />
                  <Stack.Screen name="reto/[id]" options={{ animation: reducedMotion ? 'none' : 'slide_from_right' }} />
                  <Stack.Screen name="configuracion" />
                  <Stack.Screen name="captura" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="asistente" />
                  <Stack.Screen name="sincronizacion" />
                  <Stack.Screen name="salas" />
                  <Stack.Screen name="diario" />
                  <Stack.Screen name="constelacion" />
                  <Stack.Screen name="integraciones" />
                  <Stack.Screen name="correo" />
                  <Stack.Screen name="notificaciones" options={{ animation: reducedMotion ? 'none' : 'slide_from_right' }} />
                  <Stack.Screen name="motivacion" options={{ animation: reducedMotion ? 'none' : 'slide_from_right' }} />
                  <Stack.Screen name="google-calendar" options={{ animation: 'none' }} />
                </Stack.Protected>
                <Stack.Protected guard={gate === 'auth'}>
                  <Stack.Screen name="(auth)" />
                </Stack.Protected>
                <Stack.Protected guard={gate === 'onboarding'}>
                  <Stack.Screen name="(onboarding)" />
                </Stack.Protected>
                <Stack.Protected guard={gate === 'recovery'}>
                  <Stack.Screen name="nueva-contrasena" />
                </Stack.Protected>
                <Stack.Screen name="index" />
                <Stack.Screen name="auth/callback" />
              </Stack>
            )}
            {gate === 'preview' ? <PreviewBadge /> : null}
            <UndoToast bottomOffset={64} />
            <ConfirmHost />
          </View>
        </ThemeProvider>
      </QueryClientProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  transparent: { backgroundColor: 'transparent' },
});

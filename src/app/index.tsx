import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/session';
import { entryRoute } from '@/features/system/entryRoute';
import { resolveGate } from '@/features/system/gate';
import { clientEnv } from '@/lib/env';

/** Punto de entrada `/`: siempre disponible; redirige según sesión y onboarding. */
export default function Index() {
  const status = useAuth((s) => s.status);
  const onboarded = useAuth((s) => s.onboarded);
  const recovery = useAuth((s) => s.recovery);
  const target = entryRoute(resolveGate(clientEnv, { status, onboarded, recovery }));
  return target ? <Redirect href={target} /> : null;
}

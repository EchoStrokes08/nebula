import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '@/data/supabase';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  /** null mientras se consulta; true cuando el usuario terminó el onboarding. */
  onboarded: boolean | null;
  /** La sesión procede de un enlace de recuperación: hay que fijar una contraseña nueva. */
  recovery: boolean;
  /** La sesión terminó sin que el usuario la cerrara (token caducado o revocado). */
  expired: boolean;
  setRecovery(value: boolean): void;
  markOnboarded(): void;
}

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  session: null,
  onboarded: null,
  recovery: false,
  expired: false,
  setRecovery: (recovery) => set({ recovery }),
  markOnboarded: () => set({ onboarded: true }),
}));

async function loadOnboarded(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase
    .from('user_preferences')
    .select('onboarding_completed_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return !!data?.onboarding_completed_at;
}

let started = false;
let intentionalSignOut = false;
/** Marca el próximo cierre de sesión como voluntario (no se mostrará «sesión caducada»). */
export function markIntentionalSignOut() { intentionalSignOut = true; }

/** Decide si un cierre de sesión debe explicarse como caducidad. */
export function isExpiry(event: string, hadSession: boolean, intentional: boolean) {
  return event === 'SIGNED_OUT' && hadSession && !intentional;
}

/** Arranca la escucha de sesión una sola vez (idempotente). */
export function startAuthListener(): void {
  if (started || !supabase) return;
  started = true;
  const client = supabase;

  let generation = 0;
  const apply = async (session: Session | null) => {
    const ownGeneration = ++generation;
    if (!session) {
      useAuth.setState({ status: 'signedOut', session: null, onboarded: null, recovery: false });
      return;
    }
    useAuth.setState({ status: 'signedIn', session, expired: false });
    try {
      const onboarded = await loadOnboarded(session.user.id);
      if (generation === ownGeneration) useAuth.setState({ onboarded });
    } catch {
      // Sin conexión: se asume completado si ya había sesión para no bloquear el acceso a la caché.
      if (generation === ownGeneration) useAuth.setState({ onboarded: true });
    }
  };

  client.auth.getSession().then(({ data }) => apply(data.session)).catch(() => apply(null));
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') useAuth.setState({ recovery: true });
    if (event === 'INITIAL_SESSION') return; // ya cubierto por getSession()
    if (event === 'TOKEN_REFRESHED') {
      useAuth.setState({ session });
      return;
    }
    if (isExpiry(event, !!useAuth.getState().session, intentionalSignOut)) useAuth.setState({ expired: true });
    if (event === 'SIGNED_OUT') intentionalSignOut = false;
    void apply(session);
  });
}

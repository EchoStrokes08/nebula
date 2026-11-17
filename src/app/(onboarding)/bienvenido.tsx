import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/forms/Chip';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { supabase } from '@/data/supabase';
import { AuthShell } from '@/features/auth/AuthShell';
import { useAuth } from '@/features/auth/session';
import { FormMessage } from '@/features/auth/FormMessage';
import { isHandleAvailable } from '@/features/auth/api';
import { HANDLE_RE } from '@/features/auth/validation';
import { useMyProfile } from '@/features/profile/useMyProfile';
import {
  defaultAnswers,
  FOCUS_WINDOWS,
  INTENSITIES,
  INTERESTS,
  isProvisionalHandle,
  toPreferencesRow,
  VISIBILITY,
  WEEKDAYS,
  type OnboardingAnswers,
} from '@/features/onboarding/options';

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// Pasos del onboarding (DISENO_UI_UX §5.3). El paso «primer hábito o meta» se añade en F04/F05,
// cuando existan esas entidades; el de recordatorios, en F09.
const BASE_STEPS = ['Intereses', 'Objetivos', 'Motivación', 'Ritmo', 'Privacidad'] as const;
type Step = 'Usuario' | (typeof BASE_STEPS)[number];


export default function Onboarding() {
  const profile = useMyProfile();
  const needsHandle = isProvisionalHandle(profile.data?.handle);
  const STEPS: Step[] = needsHandle ? ['Usuario', ...BASE_STEPS] : [...BASE_STEPS];
  const [step, setStep] = useState(0);
  const current = STEPS[step]!;
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [check, setCheck] = useState<{ handle: string; free: boolean } | null>(null);
  const candidate = handle.trim().toLowerCase();
  const validHandle = HANDLE_RE.test(candidate);
  const handleFree = validHandle && check?.handle === candidate && check.free;
  useEffect(() => {
    if (!validHandle) return;
    let cancelled = false;
    const t = setTimeout(() => {
      isHandleAvailable(candidate)
        .then((free) => !cancelled && setCheck({ handle: candidate, free }))
        .catch(() => {});
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [candidate, validHandle]);
  const [a, setA] = useState<OnboardingAnswers>(defaultAnswers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = useAuth((s) => s.session?.user.id);
  const last = step === STEPS.length - 1;

  const finish = async () => {
    if (!supabase || !userId) return;
    setBusy(true);
    setError(null);
    const prefs = await supabase
      .from('user_preferences')
      .update({ ...toPreferencesRow(a), onboarding_completed_at: new Date().toISOString() })
      .eq('user_id', userId);
    const profileUpdate: { visibility: string; handle?: string; display_name?: string } = { visibility: a.visibility };
    if (needsHandle && handleFree) profileUpdate.handle = candidate;
    if (displayName !== null && displayName.trim()) profileUpdate.display_name = displayName.trim().slice(0, 60);
    const saved = prefs.error ? prefs : await supabase.from('profiles').update(profileUpdate).eq('id', userId);
    setBusy(false);
    if (prefs.error || saved.error) {
      setError('No se pudieron guardar tus preferencias. Comprueba la conexión e inténtalo de nuevo.');
      return;
    }
    useAuth.getState().markOnboarded();
  };

  return (
    <AuthShell title={TITLES[current]} subtitle={SUBTITLES[current]}>
      <View style={styles.progress} accessibilityLabel={`Paso ${step + 1} de ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.dot, i <= step && styles.dotActive]} />
        ))}
      </View>

      {current === 'Usuario' ? (
        <View style={styles.col}>
          <TextField
            label="Nombre visible"
            value={displayName ?? profile.data?.display_name ?? ''}
            onChangeText={setDisplayName}
            maxLength={60}
          />
          <TextField
            label="@usuario"
            value={handle}
            onChangeText={setHandle}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={profile.data?.handle}
            error={validHandle && check?.handle === candidate && !check.free ? 'Ese @usuario ya está en uso.' : handle && !validHandle ? 'Entre 3 y 24 caracteres: minúsculas, números o _.' : null}
            hint={handleFree ? 'Disponible.' : 'Así te encontrarán tus amigos. Tu correo nunca es público.'}
          />
        </View>
      ) : null}

      {current === 'Intereses' ? (
        <View style={styles.wrap}>
          {INTERESTS.map((i) => (
            <Chip key={i} label={i} selected={a.interests.includes(i)} onToggle={() => setA({ ...a, interests: toggle(a.interests, i) })} />
          ))}
        </View>
      ) : null}

      {current === 'Objetivos' ? (
        <View style={styles.col}>
          {a.goals.map((g, i) => (
            <TextField
              key={i}
              label={`Objetivo ${i + 1}${i > 0 ? ' (opcional)' : ''}`}
              value={g}
              maxLength={80}
              placeholder={['Aprobar el examen de Cálculo', 'Leer 12 libros este año', 'Correr 5 km'][i]}
              onChangeText={(v) => setA({ ...a, goals: a.goals.map((x, j) => (j === i ? v : x)) })}
            />
          ))}
        </View>
      ) : null}

      {current === 'Motivación' ? (
        <View style={styles.col} accessibilityRole="radiogroup">
          {INTENSITIES.map((o) => {
            const selected = a.intensity === o.value;
            return (
              <View key={o.value} style={[styles.option, selected && styles.optionSelected]}>
                <Chip role="radio" label={o.label} selected={selected} onToggle={() => setA({ ...a, intensity: o.value })} />
                <Text variant="callout" tone="secondary">
                  {o.description}
                </Text>
                <Text variant="callout" tone="accent">
                  «{o.sample}»
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {current === 'Ritmo' ? (
        <View style={styles.col}>
          <Text variant="bodyStrong">Días en los que sueles avanzar</Text>
          <View style={styles.wrap}>
            {WEEKDAYS.map((d) => (
              <Chip
                key={d.value}
                label={d.label}
                selected={a.activeDays.includes(d.value)}
                onToggle={() => setA({ ...a, activeDays: toggle(a.activeDays, d.value) })}
              />
            ))}
          </View>
          <Text variant="bodyStrong">Cuándo te concentras mejor</Text>
          <View style={styles.wrap}>
            {FOCUS_WINDOWS.map((w) => (
              <Chip key={w.value} label={w.label} selected={a.focus.includes(w.value)} onToggle={() => setA({ ...a, focus: toggle(a.focus, w.value) })} />
            ))}
          </View>
        </View>
      ) : null}

      {current === 'Privacidad' ? (
        <View style={styles.col} accessibilityRole="radiogroup">
          {VISIBILITY.map((v) => (
            <View key={v.value} style={[styles.option, a.visibility === v.value && styles.optionSelected]}>
              <Chip role="radio" label={v.label} selected={a.visibility === v.value} onToggle={() => setA({ ...a, visibility: v.value })} />
              <Text variant="callout" tone="secondary">
                {v.description}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {error ? <FormMessage tone="danger">{error}</FormMessage> : null}

      <View style={styles.nav}>
        {step > 0 ? <Button label="Atrás" variant="ghost" onPress={() => setStep(step - 1)} /> : <View />}
        <View style={styles.navRight}>
          {!last ? <Button label="Omitir" variant="ghost" onPress={() => setStep(step + 1)} /> : null}
          <Button label={last ? 'Empezar' : 'Continuar'} loading={busy} onPress={() => (last ? finish() : setStep(step + 1))} />
        </View>
      </View>
    </AuthShell>
  );
}

const TITLES: Record<Step, string> = {
  Usuario: 'Cómo te verán',
  Intereses: '¿En qué quieres avanzar?',
  Objetivos: 'Tus objetivos',
  Motivación: 'Cómo quieres que te hablemos',
  Ritmo: 'Tu ritmo',
  Privacidad: 'Tu privacidad',
};
const SUBTITLES: Record<Step, string> = {
  Usuario: 'Elige tu @usuario. Puedes dejar el provisional y cambiarlo más tarde.',
  Intereses: 'Elige las áreas que te importan. Podrás cambiarlas cuando quieras.',
  Objetivos: 'Escribe hasta tres. Después podrás convertirlos en metas medibles.',
  Motivación: 'Nebula te recordará tus compromisos con este tono.',
  Ritmo: 'Lo usaremos para proponerte horarios realistas.',
  Privacidad: 'Por defecto, ¿quién puede ver tu actividad?',
};

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: spacing[2] },
  dot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.track },
  dotActive: { backgroundColor: colors.accentBright },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  col: { gap: spacing[3] },
  option: { gap: spacing[2], padding: spacing[4], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  optionSelected: { borderColor: colors.accentBright },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navRight: { flexDirection: 'row', gap: spacing[2] },
});

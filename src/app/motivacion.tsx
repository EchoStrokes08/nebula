import { Quote, Star, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/forms/Chip';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { useToast } from '@/components/overlays/UndoToast';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { INTENSITY_LABEL, libraryPhrases, ownPhrases, quotePhrases, type Phrase } from '@/domain/motivation/catalog';
import type { Intensity } from '@/domain/motivation/library';
import { useAddPhrase, useDeletePhrase, useFeaturedPhrase, useOwnPhrases } from '@/features/motivation/phrases';
import { usePreferences, useUpdatePreferences } from '@/features/profile/usePreferences';
import { platformHaptics } from '@/platform/haptics';

const LEVEL_HINT: Record<Intensity, string> = {
  balanced: 'Amables y serenas: para empezar sin presión.',
  demanding: 'Directas: te recuerdan lo que cuesta no actuar.',
  intense: 'Sin rodeos: para los días en que necesitas un empujón fuerte.',
};
const LEVELS = Object.keys(INTENSITY_LABEL) as Intensity[];
const PAGE = 12;

function PhraseRow({ phrase, featured, onFeature, onDelete }: { phrase: Phrase; featured: boolean; onFeature(): void; onDelete?: () => void }) {
  return (
    <View style={[styles.phrase, featured && styles.phraseOn]}>
      <Pressable onPress={onFeature} style={styles.flex} accessibilityRole="radio" accessibilityState={{ checked: featured }} accessibilityLabel={`${phrase.text}${phrase.author ? `, ${phrase.author}` : ''}`} accessibilityHint="Elegir como frase principal de Hoy">
        <Text variant="body">{phrase.text}</Text>
        {phrase.author ? <Text variant="caption" tone="tertiary">— {phrase.author}{phrase.source ? `, ${phrase.source}` : ''}</Text> : null}
      </Pressable>
      <Pressable onPress={onFeature} hitSlop={8} accessibilityRole="button" accessibilityLabel={featured ? 'Es tu frase principal' : 'Elegir como principal'} style={styles.icon}>
        <Star size={20} color={featured ? colors.warning : colors.textTertiary} fill={featured ? colors.warning : 'transparent'} />
      </Pressable>
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={8} accessibilityRole="button" accessibilityLabel="Borrar frase" style={styles.icon}>
          <Trash2 size={18} color={colors.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

export default function Motivacion() {
  const prefs = usePreferences();
  const update = useUpdatePreferences();
  const own = useOwnPhrases();
  const add = useAddPhrase();
  const remove = useDeletePhrase();
  const featured = useFeaturedPhrase();
  const toast = useToast((t) => t.show);
  const mine = prefs.data?.motivationIntensity ?? 'balanced';
  const [levelDraft, setLevel] = useState<Intensity | null>(null);
  const level = levelDraft ?? mine;
  const [text, setText] = useState('');
  const [author, setAuthor] = useState('');
  const [shown, setShown] = useState(PAGE);

  const feature = (p: Phrase) => {
    platformHaptics.tap();
    const next = featured?.ref === p.ref ? null : p.ref;
    update.mutate({ featured_phrase: next }, {
      onSuccess: () => toast(next ? 'Será tu frase principal en Hoy.' : 'Hoy volverá a mostrar un mensaje según tu día.'),
      onError: () => toast('No se pudo guardar. Comprueba la conexión.'),
    });
  };
  const submit = () => {
    if (!text.trim()) return;
    add.mutate({ text, author }, {
      onSuccess: (id) => {
        setText(''); setAuthor('');
        // La primera frase propia pasa a ser la principal si aún no había ninguna.
        if (!featured) update.mutate({ featured_phrase: `propia:${id}` });
        toast(featured ? 'Frase añadida.' : 'Frase añadida y elegida como principal.');
      },
      onError: () => toast('No se pudo guardar la frase.'),
    });
  };

  const quotes = quotePhrases(level);
  const nebula = libraryPhrases(level);

  return (
    <Screen title="Motivación" subtitle="Elige la frase que verás cada día en Hoy, o escribe la tuya." back={{ fallback: '/hoy' }}>
      <View style={styles.hero} accessibilityRole="summary">
        <Quote size={22} color={colors.accentSoft} />
        {featured ? (
          <>
            <Text variant="title3">{featured.text}</Text>
            {featured.author ? <Text variant="callout" tone="secondary">— {featured.author}</Text> : null}
            <Text variant="caption" tone="tertiary">Tu frase principal. Toca la estrella de otra para cambiarla.</Text>
          </>
        ) : (
          <>
            <Text variant="title3">Aún no tienes frase principal</Text>
            <Text variant="callout" tone="secondary">Toca la estrella de cualquier frase. Mientras tanto, Hoy muestra un mensaje según tu día.</Text>
          </>
        )}
      </View>

      <Text variant="title2">Agregar tu propia frase</Text>
      <TextField label="Frase" value={text} onChangeText={setText} multiline maxLength={300} placeholder="Hecho es mejor que perfecto." />
      <TextField label="Autor (opcional)" value={author} onChangeText={setAuthor} maxLength={80} placeholder="Tú, un libro, alguien que admiras…" />
      <Button label="Añadir frase" onPress={submit} loading={add.isPending} disabled={!text.trim()} />

      {(own.data ?? []).length ? (
        <View style={styles.section}>
          <Text variant="title2">Tus frases</Text>
          {ownPhrases(own.data ?? []).map((p) => (
            <PhraseRow key={p.ref} phrase={p} featured={featured?.ref === p.ref} onFeature={() => feature(p)} onDelete={() => remove.mutate(p.ref.slice('propia:'.length))} />
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text variant="title2">Según tu nivel de exigencia</Text>
        <View style={styles.wrap} accessibilityRole="radiogroup">
          {LEVELS.map((l) => (
            <Chip key={l} role="radio" label={`${INTENSITY_LABEL[l]}${l === mine ? ' · tu nivel' : ''}`} selected={level === l} onToggle={() => { setLevel(l); setShown(PAGE); }} />
          ))}
        </View>
        <Text variant="callout" tone="secondary">{LEVEL_HINT[level]}</Text>
        {level !== mine ? (
          <Button label={`Usar «${INTENSITY_LABEL[level]}» en mis mensajes`} variant="secondary" loading={update.isPending} onPress={() => update.mutate({ motivation_intensity: level }, { onSuccess: () => toast('Nivel de exigencia actualizado.') })} />
        ) : null}
      </View>

      <View style={styles.section}>
        <Text variant="overline" tone="accent">FRASES CÉLEBRES</Text>
        {quotes.map((p) => <PhraseRow key={p.ref} phrase={p} featured={featured?.ref === p.ref} onFeature={() => feature(p)} />)}
      </View>

      <View style={styles.section}>
        <Text variant="overline" tone="accent">DE NEBULA</Text>
        {nebula.slice(0, shown).map((p) => <PhraseRow key={p.ref} phrase={p} featured={featured?.ref === p.ref} onFeature={() => feature(p)} />)}
        {nebula.length > shown ? <Button label={`Ver más (${nebula.length - shown})`} variant="ghost" onPress={() => setShown((n) => n + PAGE * 2)} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing[2], padding: spacing[5], borderRadius: radius.xl, backgroundColor: 'rgba(128, 85, 232, 0.18)', borderWidth: 1, borderColor: colors.borderStrong },
  section: { gap: spacing[3] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  flex: { flex: 1, gap: 4 },
  phrase: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  phraseOn: { borderColor: colors.warning, backgroundColor: 'rgba(242, 184, 102, 0.10)' },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});

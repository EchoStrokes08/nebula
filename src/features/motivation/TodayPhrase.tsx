import { router } from 'expo-router';

import type { MotivationContext } from '@/domain/motivation/engine';

import { MotivationLine } from './MotivationLine';
import { PhraseHero } from './PhraseHero';
import { useFeaturedPhrase } from './phrases';

/** Hoy: la frase principal elegida en Motivación; si no hay, el mensaje contextual del día. Ambas en grande. */
export function TodayPhrase({ moment }: { moment: MotivationContext['moment'] }) {
  const featured = useFeaturedPhrase();
  if (!featured) return <MotivationLine moment={moment} hero />;
  return (
    <PhraseHero
      label="TU FRASE DE HOY"
      text={featured.text}
      author={featured.author}
      onPress={() => router.push('/motivacion')}
      accessibilityHint="Abre Motivación para cambiar la frase"
    />
  );
}

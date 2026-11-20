import { LinearGradient } from 'expo-linear-gradient';
import { Check, Clock } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Switch } from '@/components/forms/Switch';
import { Text } from '@/components/primitives/Text';
import { skyForHour, skyList, skies, type SkyChoice } from '@/design/sky';
import { colors, radius, spacing } from '@/design/tokens';

import { useAppearance } from './store';

function Swatch({ choice, selected, onPress }: { choice: SkyChoice; selected: boolean; onPress(): void }) {
  const theme = skies[choice === 'auto' ? skyForHour(new Date().getHours()) : choice];
  const name = choice === 'auto' ? 'Automático' : theme.name;
  const hint = choice === 'auto' ? 'Cambia con la hora' : theme.description;
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`${name}: ${hint}`} style={[styles.swatch, selected && styles.selected]}>
      <LinearGradient colors={[theme.nebulae[0]!.color, theme.sky[0], theme.nebulae[1]!.color]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={styles.preview}>
        {choice === 'auto' ? <Clock size={18} color="#fff" /> : null}
        {selected ? <View style={styles.check}><Check size={12} color="#fff" strokeWidth={3} /></View> : null}
      </LinearGradient>
      <Text variant="caption">{name}</Text>
      <Text variant="caption" tone="tertiary">{hint}</Text>
    </Pressable>
  );
}

/** Elección del cielo de fondo y de su animación (por dispositivo). */
export function SkyPicker() {
  const sky = useAppearance((s) => s.sky);
  const lively = useAppearance((s) => s.livelyBackground);
  const setSky = useAppearance((s) => s.setSky);
  const setLively = useAppearance((s) => s.setLively);
  return (
    <View style={styles.root}>
      <View style={styles.grid} accessibilityRole="radiogroup">
        {(['auto', ...skyList.map((s) => s.id)] as SkyChoice[]).map((c) => <Swatch key={c} choice={c} selected={sky === c} onPress={() => setSky(c)} />)}
      </View>
      <Switch label="Fondo animado" description="La galaxia gira despacio, las nebulosas se mueven y cruza alguna estrella fugaz." value={lively} onChange={setLively} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[4] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  swatch: { width: 104, gap: 4, padding: spacing[2], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  selected: { borderColor: colors.accentBright, backgroundColor: colors.accentMuted },
  preview: { height: 58, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  check: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});

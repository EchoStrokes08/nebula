import { PencilLine, Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Text } from '@/components/primitives/Text';
import { colors, fontFamily, radius, spacing, userColors } from '@/design/tokens';
import { describeTemplate, groupTemplates, searchTemplates, TEMPLATE_CATEGORIES, templateCount, type HabitTemplate, type TemplateCategory } from '@/domain/habits/templates';
import { platformHaptics } from '@/platform/haptics';

import { HabitIcon } from './icons';

/**
 * Primer paso al crear un hábito: sugerencias por categoría (Salud, Ejercicio, Mente…) con
 * buscador. En «Todas» y al buscar se muestran agrupadas en secciones; cada cabecera filtra por
 * su categoría. Elegir una rellena el formulario; «Crear uno propio» empieza en blanco.
 */
export function TemplatePicker({ onPick, onScratch }: { onPick(t: HabitTemplate): void; onScratch(name?: string): void }) {
  const [category, setCategory] = useState<TemplateCategory | null>(null);
  const [query, setQuery] = useState('');
  const list = searchTemplates(query, query ? null : category);
  const groups = groupTemplates(list);
  const grouped = !!query || !category;
  const pickCategory = (id: TemplateCategory | null) => { platformHaptics.tap(); setQuery(''); setCategory(id); };

  const card = (t: HabitTemplate) => (
    <Animated.View key={t.id} entering={FadeIn.duration(180)} layout={LinearTransition.duration(180)} style={styles.cell}>
      <Pressable
        onPress={() => { platformHaptics.tap(); onPick(t); }}
        accessibilityRole="button"
        accessibilityLabel={`${t.name}: ${describeTemplate(t)}. ${t.why}`}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.card, (pressed || hovered) && { borderColor: userColors[t.color] }, pressed && styles.pressed]}
      >
        <View style={[styles.icon, { backgroundColor: `${userColors[t.color]}22`, borderColor: `${userColors[t.color]}55` }]}>
          <HabitIcon name={t.icon} size={20} color={userColors[t.color]} strokeWidth={2} />
        </View>
        <Text variant="bodyStrong" numberOfLines={1}>{t.name}</Text>
        <Text variant="caption" tone="accent" numberOfLines={1}>{describeTemplate(t)}</Text>
        <Text variant="caption" tone="tertiary" numberOfLines={2}>{t.why}</Text>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.search}>
        <Search size={18} color={colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Busca: agua, leer, correr…"
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel="Buscar un hábito sugerido"
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catsScroll} contentContainerStyle={styles.cats} accessibilityRole="tablist">
        {[{ id: null, label: 'Todas', emoji: '🌌' }, ...TEMPLATE_CATEGORIES].map((c) => {
          const on = !query && category === c.id;
          return (
            <Pressable
              key={c.id ?? 'todas'}
              onPress={() => pickCategory(c.id as TemplateCategory | null)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.cat, on && styles.catOn]}
            >
              <Text variant="title3">{c.emoji}</Text>
              <Text variant="caption" tone={on ? 'primary' : 'secondary'} numberOfLines={1}>{c.label}</Text>
              <Text variant="caption" tone={on ? 'accent' : 'tertiary'}>{templateCount(c.id as TemplateCategory | null)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable onPress={() => onScratch(query.trim() || undefined)} accessibilityRole="button" style={({ pressed }) => [styles.scratch, pressed && styles.pressed]}>
        <View style={[styles.icon, { backgroundColor: colors.accentMuted, borderColor: colors.borderStrong }]}>
          <PencilLine size={20} color={colors.accentSoft} />
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{query.trim() ? `Crear «${query.trim()}»` : 'Crear uno propio'}</Text>
          <Text variant="caption" tone="tertiary">Desde cero, con todas las opciones.</Text>
        </View>
      </Pressable>

      {list.length === 0 ? <Text tone="secondary">No hay sugerencias con ese nombre. Créalo desde cero arriba.</Text> : null}
      {grouped ? (
        groups.map(({ category: c, items }) => (
          <View key={c.id} style={styles.section}>
            <Pressable
              onPress={() => pickCategory(c.id)}
              accessibilityRole="button"
              accessibilityHint="Muestra solo esta categoría"
              style={({ pressed }) => [styles.sectionHead, pressed && styles.pressed]}
            >
              <Text variant="title3">{c.emoji}</Text>
              <Text style={styles.sectionTitle}>{c.label}</Text>
              <View style={styles.sectionLine} />
              <Text variant="caption" tone="tertiary">{query ? items.length : `${items.length} · Ver`}  ›</Text>
            </Pressable>
            <View style={styles.grid}>{items.map(card)}</View>
          </View>
        ))
      ) : (
        <View style={styles.grid}>{list.map(card)}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[4] },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[4], minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  searchInput: { flex: 1, color: colors.text, fontFamily: fontFamily.regular, fontSize: 16, paddingVertical: spacing[3], outlineStyle: 'none' } as object,
  catsScroll: { marginHorizontal: -spacing[5], flexGrow: 0 },
  cats: { gap: spacing[2], paddingHorizontal: spacing[5] },
  cat: { alignItems: 'center', gap: 2, minWidth: 78, paddingVertical: spacing[2], paddingHorizontal: spacing[3], borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  catOn: { backgroundColor: colors.accentMuted, borderColor: colors.accentBright },
  scratch: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4], borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong },
  section: { gap: spacing[2] },
  sectionTitle: { fontFamily: fontFamily.serif, fontSize: 24, lineHeight: 28, color: colors.text },
  sectionLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[1] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing[1] },
  cell: { width: '50%', padding: spacing[1] },
  card: { flex: 1, gap: 4, padding: spacing[4], minHeight: 150, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: spacing[1] },
  flex: { flex: 1 },
  pressed: { transform: [{ scale: 0.98 }] },
});

import { Check, ChevronDown, Search } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Sheet } from '@/components/overlays/Sheet';
import { Text } from '@/components/primitives/Text';
import { colors, fontFamily, hitTarget, radius, spacing } from '@/design/tokens';

export interface Option<T extends string> { value: T; label: string; description?: string }

/** A partir de cuántas opciones se muestra el buscador. */
export const SEARCH_MIN_OPTIONS = 8;

/** Filtra por texto sin distinguir mayúsculas ni tildes. */
export function filterOptions<T extends { label: string; description?: string }>(options: T[], query: string): T[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const q = norm(query.trim());
  return q ? options.filter((o) => norm(`${o.label} ${o.description ?? ''}`).includes(q)) : options;
}

/** Selector de una opción en hoja inferior (Android) o modal (escritorio); con muchas opciones, buscable. */
export function Select<T extends string>({ label, value, options, onChange, placeholder = 'Elegir…' }: { label: string; value: T | null; options: Option<NoInfer<T>>[]; onChange(v: NoInfer<T>): void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const current = options.find((o) => o.value === value);
  const searchable = options.length >= SEARCH_MIN_OPTIONS;
  const shown = searchable ? filterOptions(options, query) : options;
  const close = () => { setOpen(false); setQuery(''); };
  return (
    <View style={styles.root}>
      <Text variant="caption" tone="secondary">{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="combobox"
        accessibilityLabel={label}
        accessibilityValue={{ text: current?.label ?? placeholder }}
        accessibilityState={{ expanded: open }}
        style={(s: { focused?: boolean; hovered?: boolean }) => [styles.box, s.hovered && styles.hover, s.focused && Platform.OS === 'web' && styles.focus]}
      >
        <Text style={styles.flex} numberOfLines={1} tone={current ? 'primary' : 'tertiary'}>{current?.label ?? placeholder}</Text>
        <ChevronDown size={18} color={colors.textSecondary} />
      </Pressable>
      <Sheet visible={open} onClose={close} title={label}>
        {searchable ? (
          <View style={styles.search}>
            <Search size={18} color={colors.textTertiary} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Buscar…" placeholderTextColor={colors.textTertiary} accessibilityLabel={`Buscar en ${label}`} style={styles.searchInput} returnKeyType="search" />
          </View>
        ) : null}
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {!shown.length ? <Text tone="secondary">Nada coincide con «{query.trim()}».</Text> : null}
          {shown.map((o) => {
            const selected = o.value === value;
            return (
              <Pressable key={o.value} onPress={() => { onChange(o.value); close(); }} accessibilityRole="radio" accessibilityState={{ checked: selected }} aria-checked={selected} accessibilityLabel={o.label} style={(s: { hovered?: boolean }) => [styles.option, (selected || s.hovered) && styles.optionOn]}>
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{o.label}</Text>
                  {o.description ? <Text variant="caption" tone="secondary">{o.description}</Text> : null}
                </View>
                {selected ? <Check size={18} color={colors.accentSoft} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[2] },
  box: { flexDirection: 'row', alignItems: 'center', minHeight: hitTarget + 4, paddingHorizontal: spacing[4], borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  hover: { borderColor: colors.accentBright },
  focus: { outlineColor: colors.borderFocus, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2 } as object,
  flex: { flex: 1 },
  list: { maxHeight: 420, flexShrink: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[4], minHeight: 46, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  searchInput: { flex: 1, color: colors.text, fontFamily: fontFamily.regular, fontSize: 16, paddingVertical: spacing[2], outlineStyle: 'none' } as object,
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: hitTarget, paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md },
  optionOn: { backgroundColor: colors.accentMuted },
});

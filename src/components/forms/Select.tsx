import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/overlays/Sheet';
import { Text } from '@/components/primitives/Text';
import { colors, hitTarget, radius, spacing } from '@/design/tokens';

export interface Option<T extends string> { value: T; label: string; description?: string }

/** Selector de una opción en hoja inferior (Android) o modal (escritorio). */
export function Select<T extends string>({ label, value, options, onChange, placeholder = 'Elegir…' }: { label: string; value: T | null; options: Option<NoInfer<T>>[]; onChange(v: NoInfer<T>): void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
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
        <Text style={styles.flex} tone={current ? 'primary' : 'tertiary'}>{current?.label ?? placeholder}</Text>
        <ChevronDown size={18} color={colors.textSecondary} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <ScrollView style={styles.list}>
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <Pressable key={o.value} onPress={() => { onChange(o.value); setOpen(false); }} accessibilityRole="radio" accessibilityState={{ checked: selected }} aria-checked={selected} accessibilityLabel={o.label} style={(s: { hovered?: boolean }) => [styles.option, (selected || s.hovered) && styles.optionOn]}>
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
  list: { maxHeight: 420 },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: hitTarget, paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md },
  optionOn: { backgroundColor: colors.accentMuted },
});

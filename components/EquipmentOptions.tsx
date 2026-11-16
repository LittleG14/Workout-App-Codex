import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { EQUIPMENT_OPTIONS, isImplicitEquipment } from '../shared/equipment';

/** The same chip vocabulary/style for custom requirements and available equipment. */
export function EquipmentOptions({ selected, onToggle, implicitBodyweight = false, disabled = false }: {
  selected: readonly string[]; onToggle: (value: string) => void; implicitBodyweight?: boolean; disabled?: boolean;
}) {
  return <View style={styles.row}>{EQUIPMENT_OPTIONS.map(eq => {
    const implicit = implicitBodyweight && isImplicitEquipment(eq);
    const checked = implicit || selected.includes(eq);
    return <Pressable key={eq} accessibilityRole="checkbox" accessibilityLabel={implicit ? `${eq}, always available` : eq}
      accessibilityState={{ checked, disabled: implicit || disabled }} disabled={implicit || disabled}
      style={[styles.chip, checked && styles.active]} onPress={() => onToggle(eq)}>
      {checked && <Ionicons name="checkmark" size={12} color={Colors.primary} />}
      <Text style={[styles.text, checked && styles.activeText]}>{eq}{implicit ? ' (always)' : ''}</Text>
    </Pressable>;
  })}</View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, flexShrink: 1 },
  active: { backgroundColor: `${Colors.primary}18`, borderColor: Colors.primary },
  text: { fontSize: 13, fontFamily: 'Rubik_500Medium', color: Colors.textSecondary, flexShrink: 1 },
  activeText: { color: Colors.primary },
});

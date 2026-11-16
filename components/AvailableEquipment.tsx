import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Colors from '@/constants/colors';
import { useEquipmentPreferences } from '@/lib/useEquipmentPreferences';
import { EquipmentOptions } from './EquipmentOptions';
import { AVAILABLE_EQUIPMENT_OPTIONS, validateEquipmentPreferences } from '../shared/equipment';

export function AvailableEquipment({ buttonStyle, textStyle }: { buttonStyle: StyleProp<ViewStyle>; textStyle: StyleProp<TextStyle> }) {
  const preferences = useEquipmentPreferences();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [unconfigured, setUnconfigured] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const requestId = useRef(0);
  const { refetch } = preferences;
  useFocusEffect(useCallback(() => { void refetch(); return () => { requestId.current++; }; }, [refetch]));
  const load = async () => {
    const id = ++requestId.current;
    setLoading(true); setReady(false); setError('');
    try {
      const pref = await preferences.loadLatest();
      if (id !== requestId.current) return;
      // Unconfigured accounts currently allow all; empty drafts are reserved for saved bodyweight-only preferences.
      setDraft(pref.configured ? [...pref.availableEquipment] : [...AVAILABLE_EQUIPMENT_OPTIONS]); setUnconfigured(!pref.configured); setReady(true);
    } catch (err) {
      if (id === requestId.current) setError(err instanceof Error ? err.message : 'Could not load equipment. Please retry.');
    } finally { if (id === requestId.current) setLoading(false); }
  };
  const close = () => { if (busy.current) return; requestId.current++; setVisible(false); setDraft([]); setError(''); setReady(false); };
  const save = async () => {
    if (busy.current || !ready) return;
    busy.current = true; setSaving(true); setError('');
    const id = requestId.current;
    try {
      await preferences.save(validateEquipmentPreferences({ configured: true, availableEquipment: draft }));
      if (id === requestId.current) { setVisible(false); setDraft([]); setReady(false); }
    } catch (err) {
      if (id === requestId.current) setError(err instanceof Error ? err.message : 'Equipment was not saved. Please retry.');
    } finally { busy.current = false; setSaving(false); }
  };
  return <>
    <Pressable style={[buttonStyle, styles.trigger]} accessibilityRole="button" accessibilityLabel="Available Equipment"
      testID="available-equipment-button" onPress={() => { setVisible(true); void load(); }}>
      <Text style={[textStyle, styles.triggerText]}>Available Equipment</Text>
    </Pressable>
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={[styles.modal, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal>
        <Text accessibilityRole="header" style={styles.title}>Available Equipment</Text>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.help}>Choose the equipment you can use. Bodyweight and no-equipment exercises are always available. Clear all external equipment for bodyweight-only workouts.</Text>
          {loading && <ActivityIndicator accessibilityLabel="Loading equipment" color={Colors.primary} />}
          {!!error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
          {!loading && !ready && <Pressable style={styles.control} accessibilityRole="button" onPress={() => void load()}><Text style={styles.controlText}>Retry loading equipment</Text></Pressable>}
          {ready && <>
            {unconfigured && <Text style={styles.help}>No preference is saved yet. Workouts currently use the full exercise pool. Saving enables equipment filtering.</Text>}
            <View style={styles.actions}>
              <Pressable style={styles.control} accessibilityRole="button" disabled={saving} onPress={() => setDraft([...AVAILABLE_EQUIPMENT_OPTIONS])}><Text style={styles.controlText}>Select all</Text></Pressable>
              <Pressable style={styles.control} accessibilityRole="button" disabled={saving} onPress={() => setDraft([])}><Text style={styles.controlText}>Clear all</Text></Pressable>
            </View>
            <EquipmentOptions implicitBodyweight selected={draft} disabled={saving} onToggle={eq => setDraft(old => old.includes(eq) ? old.filter(e => e !== eq) : [...old, eq])} />
          </>}
        </ScrollView>
        <View style={styles.actions}>
          <Pressable style={styles.control} accessibilityRole="button" accessibilityState={{ disabled: saving }} disabled={saving} onPress={close}><Text style={styles.controlText}>Cancel</Text></Pressable>
          <Pressable style={[styles.control, styles.save, (!ready || saving || loading) && styles.disabled]} accessibilityRole="button"
            accessibilityLabel={saving ? 'Saving equipment' : 'Save equipment'} accessibilityState={{ disabled: !ready || saving || loading, busy: saving }}
            disabled={!ready || saving || loading} onPress={() => void save()}>
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  trigger: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  triggerText: { textAlign: 'center', flexShrink: 1 },
  modal: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 20 },
  title: { fontSize: 24, fontFamily: 'Rubik_700Bold', color: Colors.text, marginBottom: 16 },
  content: { paddingBottom: 24, gap: 16 },
  help: { fontSize: 15, fontFamily: 'Rubik_400Regular', color: Colors.textSecondary, lineHeight: 23 },
  error: { color: Colors.error, fontSize: 15, marginVertical: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  control: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  controlText: { fontFamily: 'Rubik_500Medium', color: Colors.text, fontSize: 15 },
  save: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  saveText: { fontFamily: 'Rubik_600SemiBold', color: '#FFF', fontSize: 16 },
  disabled: { opacity: 0.5 },
});

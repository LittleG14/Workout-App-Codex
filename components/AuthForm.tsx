import React, { type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

export function AuthPanel({ title, message, children }: { title: string; message: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {children}
    </ScrollView>
  </KeyboardAvoidingView>;
}
export function AuthField({ label, ...props }: TextInputProps & { label: string }) {
  return <><Text style={styles.message}>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} placeholderTextColor={Colors.textMuted} autoCapitalize="none" autoCorrect={false} {...props} /></>;
}
export function AuthButton({ label, onPress, busy = false, disabled = false }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress} style={[styles.button, (busy || disabled) && { opacity: 0.6 }]}>
    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}
  </Pressable>;
}
export function AuthNotice({ children }: { children: ReactNode }) { return <Text accessibilityRole="alert" style={styles.message}>{children}</Text>; }
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background }, content: { paddingHorizontal: 24, gap: 16 },
  title: { color: Colors.text, fontFamily: 'Rubik_600SemiBold', fontSize: 26 },
  message: { color: Colors.textSecondary, fontSize: 16, lineHeight: 24 },
  input: { backgroundColor: Colors.surface, color: Colors.text, borderRadius: 12, padding: 16, fontSize: 17, borderWidth: 1, borderColor: Colors.border },
  button: { backgroundColor: Colors.primary, borderRadius: 12, padding: 17, minHeight: 54, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Uses system fonts and no provider hooks so failed font/auth startup can render it. */
export function StartupFailure({ message, retry }: { message: string; retry: () => void }) {
  return <View style={styles.screen}>
    <Text accessibilityRole="header" style={styles.title}>Let’s try opening Swole House again</Text>
    <Text accessibilityRole="alert" style={styles.message}>{message}</Text>
    <Pressable accessibilityRole="button" onPress={retry} style={styles.button}><Text style={styles.label}>Try again</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', backgroundColor: '#0D0D0D', padding: 32, gap: 20 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700' },
  message: { color: '#ddd', fontSize: 17, lineHeight: 25 },
  button: { backgroundColor: '#E04500', padding: 18, borderRadius: 12, alignItems: 'center' },
  label: { color: '#fff', fontSize: 17, fontWeight: '600' },
});

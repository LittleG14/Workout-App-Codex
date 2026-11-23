import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
export default function TraceRouteWeb() {
  return <View style={{ flex: 1, backgroundColor: Colors.background, padding: 24, justifyContent: 'center', gap: 20 }}>
    <Text style={{ color: Colors.text, fontSize: 22 }}>Trace Route</Text>
    <Text style={{ color: Colors.textSecondary }}>Interactive route tracing uses the installed mobile app’s native map. This repository’s web preview has a map placeholder. Your saved plan remains unchanged.</Text>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ padding: 16, backgroundColor: Colors.surface }}><Text style={{ color: Colors.text }}>Back to Just Run</Text></Pressable>
  </View>;
}

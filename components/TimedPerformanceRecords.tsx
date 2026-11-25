import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/colors';
import { formatCircuitTime } from '@/lib/circuit-session';
import type { TimedPerformance } from '@/lib/circuit-performance';
export function TimedPerformanceRecords({ records }: { records: TimedPerformance[] }) {
  return <>{records.map(record => <View key={record.key} style={styles.card}>
    <Text style={styles.heading}>HYROX time</Text>
    <Text style={styles.label}>{record.label}</Text>
    <View style={styles.row}>
      <View style={styles.column}><Text style={styles.label}>PR · fastest confirmed</Text><Text style={styles.time}>{record.prElapsedMs ? formatCircuitTime(record.prElapsedMs) : 'Unavailable'}</Text>
        {record.prDate && <Text style={styles.date}>{new Date(record.prDate).toLocaleDateString()}</Text>}</View>
      <View style={styles.column}><Text style={styles.label}>Last · confirmed work</Text><Text style={styles.time}>{formatCircuitTime(record.lastElapsedMs)}</Text>
        <Text style={styles.date}>{new Date(record.lastDate).toLocaleDateString()}</Text></View>
    </View>
    {!!record.reason && <Text style={styles.date}>{record.reason}</Text>}
  </View>)}</>;
}
const styles = StyleSheet.create({
  card: { padding: 12, borderRadius: 12, backgroundColor: Colors.surfaceLight, marginVertical: 8, gap: 8 },
  heading: { color: Colors.circuit, fontFamily: 'Rubik_600SemiBold', fontSize: 14 },
  label: { color: Colors.textSecondary, fontFamily: 'Rubik_400Regular', fontSize: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, column: { flexGrow: 1, gap: 4 },
  time: { fontFamily: 'Rubik_700Bold', fontSize: 20, fontVariant: ['tabular-nums'], color: Colors.text },
  date: { color: Colors.textMuted, fontSize: 11 },
});

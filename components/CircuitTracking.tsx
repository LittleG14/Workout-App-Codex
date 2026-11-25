import React, { useState, useSyncExternalStore } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import type { GeneratedWorkout } from '@/lib/exercises';
import { getAccountScope } from '@/lib/account-scope';
import { circuitController } from '@/lib/circuit-runtime';
import { circuitCountdownRemaining, circuitRowTiming, formatCircuitTime, projectCircuit, validateCircuitSession, emomMinutes, type CircuitSession } from '@/lib/circuit-session';
import { circuitNotificationsAvailable, requestCircuitNotifications, runAudioAvailable } from '@/lib/run-audio';
import { hyroxWorkload } from '@/lib/circuit-performance';

const report = (error: unknown) => Alert.alert('Circuit needs attention', error instanceof Error ? error.message : 'Please retry. Your saved workout is preserved.');
const perform = (task: Promise<unknown>) => { void task.catch(report); };
function useCircuit(workout: GeneratedWorkout) {
  const runtime = useSyncExternalStore(circuitController.subscribe, circuitController.getSnapshot, circuitController.getSnapshot);
  const latest = runtime.workout?.id === workout.id ? runtime.workout : workout;
  let session: CircuitSession | undefined, error = '';
  try { if (latest.circuitSession) session = projectCircuit(validateCircuitSession(latest.circuitSession, latest), runtime.clock); }
  catch (e) { error = e instanceof Error ? e.message : 'Saved measurements are unavailable.'; }
  return { runtime, workout: latest, session, error, legacy: !latest.circuitSession && (latest.circuitTrackingVersion !== 1 || latest.elapsedSeconds !== undefined) };
}
export function TrackedCircuitBlock({ workout: source, blockIndex, onLogWeight, onRefresh, onPick }: {
  workout: GeneratedWorkout; blockIndex: number; onLogWeight?: (index: number) => void; onRefresh?: (index: number) => void; onPick?: (index: number) => void;
}) {
  const { workout, session, legacy, error } = useCircuit(source);
  const [showIntervals, setShowIntervals] = useState(false);
  const block = session?.blocks[blockIndex] ?? workout.circuitBlocks![blockIndex];
  const format = workout.subType, terminal = session && ['completed', 'canceled'].includes(session.status);
  const editable = !workout.circuitSession && !legacy;
  let scheduled: number | undefined;
  try { if (format === 'emom') scheduled = emomMinutes(block); } catch { /* Preserve malformed historical prescriptions for review. */ }
  const intervals = session?.occurrences.filter(o => o.blockIndex === blockIndex && o.elapsedMs > 0) ?? [];
  return <View style={styles.card}>
    <Text style={styles.title}>{block.name}</Text>
    <View style={styles.badges}>
      {block.timeCapMinutes !== undefined && <Text style={styles.badge}>{block.timeCapMinutes} min</Text>}
      {block.rounds !== undefined && <Text style={styles.badge}>{block.rounds} rounds</Text>}
    </View>
    {format === 'emom' && <Text style={styles.hint}>{scheduled === undefined ? 'Schedule unavailable.' : `${scheduled} scheduled one-minute intervals.`} Interval completion does not confirm prescribed reps.</Text>}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {block.exercises.map((ex, i) => {
      const { occurrence, active } = circuitRowTiming(session, blockIndex, i);
      const canTap = format === 'hyrox' && session?.status === 'running';
      const time = (legacy || error || (terminal && !occurrence?.elapsedMs)) ? '—' : formatCircuitTime(occurrence?.elapsedMs ?? 0);
      return <View key={`${blockIndex}:${i}`} style={[styles.row, i > 0 && styles.border, active && styles.active]}>
        <View style={styles.line}>
          <View style={styles.dot} />
          <Pressable style={styles.main} disabled={!canTap} accessibilityRole={format === 'hyrox' ? 'button' : undefined}
            accessibilityLabel={`${ex.exercise.name}${format !== 'amrap' ? `, ${time}` : ''}${canTap ? ', tap to start or stop timing' : ''}`}
            accessibilityState={{ disabled: !canTap, selected: active }}
            onPress={() => occurrence && perform(circuitController.action(workout.id, { type: 'station', id: occurrence.id }))}>
            {!!ex.notes && <Text style={styles.note}>{ex.notes}</Text>}
            <View style={styles.nameLine}>
              <Text style={[styles.name, active && styles.emphasis]}>{ex.exercise.name}</Text>
              {(format === 'hyrox' || format === 'emom') && <Text style={[styles.timer, active && styles.emphasis]}>{time}</Text>}
            </View>
            <Text style={[styles.reps, active && styles.emphasis]}>{ex.reps}{ex.weight ? ` · ${ex.weight} ${ex.weightUnit ?? 'lbs'}` : ''}</Text>
            {format === 'emom' && occurrence && <Text style={styles.note}>Round {occurrence.round + 1} · Interval {occurrence.sequence + 1} · {active ? 'Active' : occurrence.completed ? 'Interval complete' : 'Partial / paused'}</Text>}
          </Pressable>
        </View>
        {editable && <View style={styles.actions}>
          {onLogWeight && <Pressable style={styles.icon} accessibilityRole="button" accessibilityLabel={`Log load for ${ex.exercise.name}`} onPress={() => onLogWeight(i)}><Ionicons name="create-outline" size={16} color={Colors.textMuted} /></Pressable>}
          {onPick && <Pressable style={styles.icon} accessibilityRole="button" accessibilityLabel={`Choose replacement for ${ex.exercise.name}`} onPress={() => onPick(i)}><Ionicons name="pencil-outline" size={16} color={Colors.textMuted} /></Pressable>}
          {onRefresh && <Pressable style={styles.icon} accessibilityRole="button" accessibilityLabel={`Refresh ${ex.exercise.name}`} onPress={() => onRefresh(i)}><Ionicons name="refresh" size={16} color={Colors.textMuted} /></Pressable>}
        </View>}
        {format === 'hyrox' && editable && !hyroxWorkload(ex).comparable && <Text style={styles.note}>Timed PR unavailable: {hyroxWorkload(ex).reason}</Text>}
        {format === 'hyrox' && !!occurrence?.elapsedMs && <View style={styles.confirmRow}>
          <Text style={styles.note}>{occurrence.completed ? 'Work confirmed complete' : 'Time recorded; work not confirmed complete'}</Text>
          {!terminal && (session?.activeId !== occurrence.id || session.status === 'paused') && <Pressable style={styles.smallButton} accessibilityRole="checkbox" accessibilityState={{ checked: occurrence.completed }}
            accessibilityLabel={`${occurrence.completed ? 'Remove' : 'Confirm'} completion for ${ex.exercise.name}`}
            onPress={() => {
              const confirm = () => perform(circuitController.action(workout.id, { type: 'confirm', id: occurrence.id }));
              if (occurrence.completed) confirm();
              else Alert.alert('Confirm full prescribed work?', 'Confirm only if you completed this station’s entire distance/reps and specified load. Stopping its timer alone does not qualify it for a timed PR.', [{ text: 'Not yet', style: 'cancel' }, { text: 'Work completed', onPress: confirm }]);
            }}><Text style={styles.buttonText}>{occurrence.completed ? '✓ Completed' : 'Confirm complete'}</Text></Pressable>}
        </View>}
      </View>;
    })}
    {format === 'amrap' && <View style={styles.counter}>
      {session && !terminal && <>
        <Pressable style={styles.counterButton} accessibilityRole="button" accessibilityLabel={`Remove one completed round from ${block.name}`}
          disabled={!['running', 'paused'].includes(session.status) || session.rounds[blockIndex] === 0}
          onPress={() => perform(circuitController.action(workout.id, { type: 'round', blockIndex, delta: -1 }))}><Text style={styles.counterSymbol}>−</Text></Pressable>
        <Pressable style={styles.counterButton} accessibilityRole="button" accessibilityLabel={`Add one completed round to ${block.name}`}
          disabled={!['running', 'paused'].includes(session.status)}
          onPress={() => perform(circuitController.action(workout.id, { type: 'round', blockIndex, delta: 1 }))}><Text style={styles.counterSymbol}>+</Text></Pressable>
      </>}
      <Text style={styles.roundCount}>{session ? `${terminal ? 'Completed rounds' : 'Rounds'}: ${session.rounds[blockIndex]}` : legacy || error ? 'Completed rounds: unavailable' : 'Rounds: 0 · Start workout to count'}</Text>
    </View>}
    {format === 'emom' && !!intervals.length && <>
      <Pressable style={styles.smallButton} accessibilityRole="button" accessibilityState={{ expanded: showIntervals }} onPress={() => setShowIntervals(v => !v)}><Text style={styles.buttonText}>{showIntervals ? 'Hide' : 'Show'} recorded intervals ({intervals.length})</Text></Pressable>
      {showIntervals && intervals.map(o => <View key={o.id} style={styles.historyLine}>
        <Text style={[styles.note, { flex: 1 }]}>Round {o.round + 1} · Interval {o.sequence + 1} · {o.exercise.exercise.name}{!o.completed ? ' · partial' : ''}</Text>
        <Text style={styles.timer}>{formatCircuitTime(o.elapsedMs)}</Text>
      </View>)}
    </>}
  </View>;
}

export function CircuitControls({ workout: source, bottom }: { workout: GeneratedWorkout; bottom: number }) {
  const { runtime, workout, session, error, legacy } = useCircuit(source);
  const [busy, setBusy] = useState(false), [locked, setLocked] = useState(false);
  const act = async (task: () => Promise<unknown>) => { if (busy) return; setBusy(true); try { await task(); } catch (e) { report(e); } finally { setBusy(false); } };
  const status = session?.status, terminal = status === 'completed' || status === 'canceled' || legacy;
  const pendingCompletion = status === 'completed' && workout.circuitSession?.status !== 'completed';
  const finish = () => Alert.alert('Finish and save circuit?', 'Recorded time and round counts will be saved. Only explicitly confirmed HYROX stations can qualify for timed PRs.', [
    { text: 'Keep workout', style: 'cancel' }, { text: 'Finish workout', onPress: () => { void act(() => circuitController.action(workout.id, { type: 'finish' })); } },
  ]);
  return <View style={[styles.footer, { paddingBottom: bottom + 8 }]}>
    <View style={styles.footerMain}>
      {!terminal && !error && <Pressable style={styles.start} disabled={busy || !runtime.ready || status === 'countdown'} accessibilityRole="button"
        accessibilityLabel={status === 'running' ? 'Pause circuit workout' : status === 'paused' ? 'Resume circuit workout' : 'Start circuit workout'}
        onLongPress={session && ['running', 'paused'].includes(session.status) ? finish : undefined}
        onPress={() => void act(() => session ? circuitController.action(workout.id, { type: status === 'running' ? 'pause' : 'resume' }) : circuitController.start(workout.id, locked))}>
        <Ionicons name={status === 'running' ? 'pause-outline' : 'play-outline'} color={Colors.circuit} size={18} />
        <Text style={styles.buttonText}>{busy ? 'Saving…' : status === 'countdown' ? 'Starting…' : status === 'running' ? 'Pause' : status === 'paused' ? 'Resume' : 'Stopwatch'}</Text>
      </Pressable>}
      <Text style={styles.overall}>{status === 'countdown' ? Math.ceil(circuitCountdownRemaining(session!, runtime.clock) / 1000) : session ? formatCircuitTime(session.elapsedMs) : legacy ? formatCircuitTime(workout.elapsedSeconds! * 1000) : '--:--'}</Text>
      {session && !terminal && <Pressable style={styles.smallButton} disabled={busy} accessibilityRole="button" onPress={finish}><Text style={styles.buttonText}>Finish</Text></Pressable>}
    </View>
    {terminal && <Text style={styles.hint}>{pendingCompletion ? 'Intervals ended; saving the final measurements is pending.' : status === 'canceled' ? 'Canceled attempt · excluded from timed PRs.' : 'Recorded workout · measurements are read-only.'}{legacy ? ' Exercise measurements were not recorded.' : ''}</Text>}
    {pendingCompletion && !!runtime.error && <Pressable style={styles.smallButton} accessibilityRole="button" disabled={busy} onPress={() => void act(() => circuitController.action(workout.id, { type: 'finish' }))}><Text style={styles.buttonText}>Retry saving completed intervals</Text></Pressable>}
    {!terminal && workout.subType === 'hyrox' && <Text style={styles.hint}>Log prescribed loads before starting. Tap a station to start/stop; confirm its full work separately. Hold the workout control to finish.</Text>}
    {!session && !legacy && workout.subType === 'emom' && <Pressable style={styles.smallButton} disabled={busy || locked || !circuitNotificationsAvailable} accessibilityRole="button"
      onPress={() => void act(async () => { const allowed = await requestCircuitNotifications(); if (!allowed) throw new Error('Notification sounds are not enabled. Keep the app open for chimes, or allow sounds in iOS Settings.'); setLocked(true); })}>
      <Text style={styles.buttonText}>{locked ? '✓ Locked-screen chimes enabled' : circuitNotificationsAvailable ? 'Enable locked-screen chimes (optional)' : 'Locked-screen chimes need the updated iOS build'}</Text>
    </Pressable>}
    {workout.subType === 'emom' && !terminal && <Text style={styles.hint}>{session?.backgroundChimes || locked ? 'Locked-screen alerts follow iOS notification, Focus and sound settings. Up to 60 upcoming minutes are scheduled; reopen for longer workouts.' : 'Keep the app open for chimes. Timing stays accurate while backgrounded; missed chimes will not replay.'}{!runAudioAvailable ? ' Native audio is unavailable in this runtime.' : ''}</Text>}
    {(error || runtime.error || session?.warning || runtime.notificationInfo) && <Text accessibilityRole="alert" style={styles.error}>{error || runtime.error || session?.warning || runtime.notificationInfo}</Text>}
    {!runtime.ready && <Pressable style={styles.smallButton} accessibilityRole="button" onPress={() => perform(circuitController.activate(getAccountScope()))}><Text style={styles.buttonText}>Retry circuit recovery</Text></Pressable>}
    {session && !terminal && <Pressable disabled={busy} style={styles.smallButton} accessibilityRole="button" onPress={() => Alert.alert('Cancel this attempt?', 'Its recorded measurements will remain in History, but no timed PRs will be awarded.', [
      { text: 'Keep workout', style: 'cancel' }, { text: 'Cancel attempt', style: 'destructive', onPress: () => { void act(() => circuitController.action(workout.id, { type: 'cancel' })); } },
    ])}><Text style={styles.note}>{status === 'countdown' ? 'Cancel start' : 'Cancel attempt'}</Text></Pressable>}
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4, borderLeftColor: Colors.circuit },
  title: { color: Colors.circuit, fontSize: 18, fontFamily: 'Rubik_700Bold', marginBottom: 8 },
  badges: { flexDirection: 'row', gap: 8, marginBottom: 14 }, badge: { backgroundColor: `${Colors.circuit}18`, color: Colors.circuit, fontSize: 12, fontFamily: 'Rubik_600SemiBold', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  row: { paddingVertical: 10, gap: 4 }, border: { borderTopWidth: 1, borderTopColor: Colors.border },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.circuit },
  main: { flex: 1, minHeight: 44, justifyContent: 'center' }, nameLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, flexShrink: 1, fontSize: 15, fontFamily: 'Rubik_600SemiBold', color: Colors.text },
  timer: { fontVariant: ['tabular-nums'], fontSize: 11, fontFamily: 'Rubik_400Regular', color: Colors.textMuted, flexShrink: 0 },
  note: { fontSize: 11, fontFamily: 'Rubik_400Regular', color: Colors.textMuted }, reps: { marginTop: 2, fontSize: 13, color: Colors.textSecondary, fontFamily: 'Rubik_500Medium' },
  active: { backgroundColor: `${Colors.circuit}12`, borderRadius: 8 }, emphasis: { fontFamily: 'Rubik_700Bold', color: Colors.circuit },
  actions: { flexDirection: 'row', alignSelf: 'flex-end' }, icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  confirmRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  smallButton: { minHeight: 44, paddingHorizontal: 8, paddingVertical: 8, justifyContent: 'center' }, buttonText: { color: Colors.circuit, fontSize: 12, fontFamily: 'Rubik_600SemiBold' },
  counter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 12 },
  counterButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: `${Colors.circuit}18` },
  counterSymbol: { fontSize: 24, color: Colors.circuit }, roundCount: { fontFamily: 'Rubik_600SemiBold', fontSize: 14, color: Colors.text, flexShrink: 1 },
  historyLine: { flexDirection: 'row', gap: 12, paddingVertical: 5 }, hint: { color: Colors.textMuted, fontSize: 11, fontFamily: 'Rubik_400Regular', marginVertical: 4 },
  footer: { backgroundColor: Colors.surface, borderTopWidth: 1, borderColor: Colors.border, paddingHorizontal: 16, paddingTop: 8 },
  footerMain: { flexDirection: 'row', alignItems: 'center', gap: 12 }, start: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  overall: { fontVariant: ['tabular-nums'], fontFamily: 'Rubik_700Bold', fontSize: 25, color: Colors.circuit, flex: 1, textAlign: 'right' },
  error: { color: Colors.error, fontSize: 12, marginVertical: 5 },
});

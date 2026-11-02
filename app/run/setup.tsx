import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ownRun, requestRunMode, runs } from "@/lib/run-tracking";
import { getAccountScope, assertAccountScope } from "@/lib/account-scope";
import type { RunDraft } from "@/lib/run-repository";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import Colors from "@/constants/colors";

type DistanceUnit = "miles" | "km";
type NotifInterval = 0 | 0.5 | 1;

export default function RunSetupScreen() {
  const insets = useSafeAreaInsets();
  const [unit, setUnit] = useState<DistanceUnit>("miles");
  const [notifInterval, setNotifInterval] = useState<NotifInterval>(1);
  const [requesting, setRequesting] = useState(false);
  const starting = useRef(false);
  const mounted = useRef(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (countdownRef.current) clearInterval(countdownRef.current); }; }, []);
  const btnScale = useSharedValue(1);
  const btnAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  const NOTIF_OPTIONS: { value: NotifInterval; label: string }[] = [
    { value: 0, label: "Never" },
    { value: 0.5, label: `Every 0.5 ${unit === "miles" ? "mi" : "km"}` },
    { value: 1, label: `Every 1 ${unit === "miles" ? "mi" : "km"}` },
  ];

  const confirm = (title: string, message: string, proceed: string) => new Promise<boolean>(resolve => Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
    { text: proceed, onPress: () => resolve(true) },
  ], { cancelable: false }));
  const handleStartRun = async () => {
    if (starting.current) return;
    starting.current = true; setRequesting(true);
    const scope = getAccountScope();
    try {
      const existing = await ownRun(); assertAccountScope(scope);
      if (!mounted.current) return;
      if (existing) { router.push(existing.status === 'stopped' ? '/run/summary' : '/run/active'); return; }
      if (Platform.OS !== 'web' && !await confirm('Track your run or walk',
        'Location records your route, distance, and pace. Allow background location to keep tracking while your screen is locked or you use another app. Tracking stops when you pause or end the run. Android may open Settings to grant background access.', 'Continue')) return;
      if (!mounted.current) return; assertAccountScope(scope);
      const mode: RunDraft['mode'] = await requestRunMode(); assertAccountScope(scope);
      if (!mounted.current) return;
      if (mode === 'foreground' && !await confirm('Foreground tracking only',
        'Background location is unavailable or was not allowed. This run can record location only while the app stays open. Locked-screen tracking requires background permission and an installed native build. You can change location access in device Settings.', 'Run with app open')) return;
      if (!mounted.current) return; assertAccountScope(scope);
      setCountdown(5);
      let count = 5;
      countdownRef.current = setInterval(() => {
        count -= 1;
        if (count > 0) { setCountdown(count); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); return; }
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = null;
        setCountdown(0);
        void (async () => {
          try {
            assertAccountScope(scope); if (!mounted.current) return;
            await runs.begin(scope.userId, unit, notifInterval, mode);
            assertAccountScope(scope);
            if (mounted.current) router.push('/run/active');
          } catch (error) {
            if (mounted.current) Alert.alert('Could not start run', error instanceof Error ? error.message : 'Please try again.');
          } finally { if (mounted.current) { setCountdown(null); setRequesting(false); } starting.current = false; }
        })();
      }, 1000);
      return;
    } catch (error) {
      if (mounted.current) Alert.alert('Location needs attention', error instanceof Error ? error.message : 'Could not start run.', [
        { text: 'OK' },
        ...(Platform.OS === 'web' ? [] : [{ text: 'Open Settings', onPress: () => { void Linking.openSettings().catch(() => {}); } }]),
      ]);
    } finally {
      if (!countdownRef.current) { starting.current = false; if (mounted.current) setRequesting(false); }
    }
  };

  const cancelCountdown = () => {
    if (countdown === 0) return;
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null; starting.current = false; setRequesting(false);
    setCountdown(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const webTopPad = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopPad }]}>
      {countdown !== null ? (
        <Animated.View entering={FadeIn} style={styles.countdownContainer}>
          <Text style={styles.countdownLabel}>Get ready!</Text>
          <Text style={styles.countdownNumber}>{countdown}</Text>
          <Text style={styles.countdownSub}>Starting your run…</Text>
          <Pressable disabled={countdown === 0} style={styles.cancelCountdownBtn} onPress={cancelCountdown}>
            <Text style={styles.cancelCountdownText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      ) : (
        <View style={styles.content}>
          <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={24} color={Colors.text} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Ionicons name="location" size={28} color={Colors.cardio} />
              <Text style={styles.headerTitle}>Just Run</Text>
            </View>
            <View style={{ width: 40 }} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.section}>
            <Text style={styles.sectionLabel}>Distance Unit</Text>
            <View style={styles.unitToggle}>
              <Pressable
                style={[styles.unitBtn, unit === "miles" && styles.unitBtnActive]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setUnit("miles"); }}
              >
                <Ionicons
                  name="speedometer-outline"
                  size={18}
                  color={unit === "miles" ? "#FFF" : Colors.textSecondary}
                />
                <Text style={[styles.unitBtnText, unit === "miles" && styles.unitBtnTextActive]}>
                  Miles
                </Text>
              </Pressable>
              <Pressable
                style={[styles.unitBtn, unit === "km" && styles.unitBtnActive]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setUnit("km"); }}
              >
                <Ionicons
                  name="globe-outline"
                  size={18}
                  color={unit === "km" ? "#FFF" : Colors.textSecondary}
                />
                <Text style={[styles.unitBtnText, unit === "km" && styles.unitBtnTextActive]}>
                  Kilometers
                </Text>
              </Pressable>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
            <Text style={styles.sectionLabel}>Distance Alerts</Text>
            <Text style={styles.sectionSub}>
              Get an in-app alert as you hit each milestone while viewing the run screen
            </Text>
            <View style={styles.notifOptions}>
              {NOTIF_OPTIONS.map((opt) => (
                <Pressable
                  key={String(opt.value)}
                  style={[
                    styles.notifOption,
                    notifInterval === opt.value && styles.notifOptionActive,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setNotifInterval(opt.value);
                  }}
                >
                  <Ionicons
                    name={opt.value === 0 ? "notifications-off-outline" : "notifications-outline"}
                    size={20}
                    color={notifInterval === opt.value ? Colors.cardio : Colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.notifOptionText,
                      notifInterval === opt.value && styles.notifOptionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.cardio} />
            <Text style={styles.infoText}>
              Allow background location to track runs and walks with your screen locked. After an interruption or restart, tap Start Run to recover your private draft.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={[styles.startBtnWrapper, { paddingBottom: insets.bottom + 24 }]}>
            <Animated.View style={btnAnimStyle}>
              <Pressable disabled={requesting} accessibilityRole="button" style={styles.startBtn} onPress={handleStartRun}>
                <Ionicons name="location" size={22} color="#FFF" />
                <Text style={styles.startBtnText}>{requesting ? "Preparing…" : "Start Run / Recover"}</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Rubik_700Bold",
    color: Colors.text,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: "Rubik_400Regular",
    color: Colors.textSecondary,
    marginBottom: 12,
    marginTop: -6,
  },
  unitToggle: {
    flexDirection: "row",
    gap: 10,
  },
  unitBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  unitBtnActive: {
    backgroundColor: Colors.cardio,
    borderColor: Colors.cardio,
  },
  unitBtnText: {
    fontSize: 16,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textSecondary,
  },
  unitBtnTextActive: {
    color: "#FFF",
  },
  notifOptions: {
    gap: 10,
  },
  notifOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  notifOptionActive: {
    borderColor: Colors.cardio,
    backgroundColor: `${Colors.cardio}12`,
  },
  notifOptionText: {
    fontSize: 15,
    fontFamily: "Rubik_500Medium",
    color: Colors.textSecondary,
  },
  notifOptionTextActive: {
    color: Colors.cardio,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 20,
    padding: 14,
    backgroundColor: `${Colors.cardio}10`,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${Colors.cardio}30`,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Rubik_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  startBtnWrapper: {
    paddingHorizontal: 20,
    marginTop: "auto",
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.cardio,
    borderRadius: 16,
    paddingVertical: 18,
  },
  startBtnText: {
    fontSize: 18,
    fontFamily: "Rubik_700Bold",
    color: "#FFF",
  },
  countdownContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  countdownLabel: {
    fontSize: 22,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textSecondary,
  },
  countdownNumber: {
    fontSize: 96,
    fontFamily: "Rubik_700Bold",
    color: Colors.cardio,
    lineHeight: 110,
  },
  countdownSub: {
    fontSize: 17,
    fontFamily: "Rubik_400Regular",
    color: Colors.textMuted,
  },
  cancelCountdownBtn: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelCountdownText: {
    fontSize: 15,
    fontFamily: "Rubik_600SemiBold",
    color: Colors.textSecondary,
  },
});

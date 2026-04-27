import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";

interface DomainStatusResponse {
  domain: string;
  id?: string;
  status: string;
  verified?: boolean;
  message: string;
  dns_records_needed?: Array<{
    record: string;
    name: string;
    type: string;
    value: string;
    status: string;
    ttl: string;
    priority?: number;
  }>;
}

const DOMAIN_STATUS_KEY = ["/api/admin/email-domain-status"];

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const webTopPad = Platform.OS === "web" ? 67 : 0;
  const webBottomPad = Platform.OS === "web" ? 34 : 0;

  const [recheckLoading, setRecheckLoading] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState(user?.email ?? "");
  const [lastTestResult, setLastTestResult] = useState<string | null>(null);

  const {
    data: domainStatus,
    isFetching: statusLoading,
    error: statusError,
    refetch: refetchDomainStatus,
  } = useQuery<DomainStatusResponse>({
    queryKey: DOMAIN_STATUS_KEY,
    enabled: !isLoading && !!user,
    staleTime: 5 * 60 * 1000,
  });

  const errorMessage =
    statusError instanceof Error ? statusError.message : null;
  const accessDenied = !!errorMessage && errorMessage.includes("403");

  const recheckDNS = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRecheckLoading(true);
    try {
      await apiRequest("POST", "/api/admin/verify-domain");
      await refetchDomainStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert("Error", msg || "Failed to trigger DNS re-check.");
    } finally {
      setRecheckLoading(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmailTo.trim()) {
      Alert.alert("No recipient", "Enter an email address to send the test to.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTestEmailLoading(true);
    setLastTestResult(null);
    try {
      const res = await apiRequest("POST", "/api/admin/send-test-email", { to: testEmailTo.trim() });
      const data = await res.json();
      setLastTestResult(`Sent! Message ID: ${data.id ?? "—"}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert("Error", msg || "Failed to send test email.");
    } finally {
      setTestEmailLoading(false);
    }
  };

  if (!isLoading && !user) {
    return <Redirect href="/(auth)" />;
  }

  if (accessDenied) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopPad, alignItems: "center", justifyContent: "center" }]}>
        <Ionicons name="lock-closed" size={48} color={Colors.textMuted} />
        <Text style={styles.accessDeniedTitle}>Access Denied</Text>
        <Text style={styles.accessDeniedSub}>This area is only available to admins.</Text>
        <Pressable style={[styles.actionBtn, { marginTop: 24, paddingHorizontal: 32 }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={16} color="#fff" />
          <Text style={styles.actionBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const isVerified = domainStatus?.verified === true;
  const isPending =
    domainStatus &&
    !domainStatus.verified &&
    domainStatus.status !== "not_registered";
  const isNotRegistered = domainStatus?.status === "not_registered";

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + webTopPad },
      ]}
    >
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.screenTitle}>Admin</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + webBottomPad + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(50).duration(400)}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="mail" size={18} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Email Domain Status</Text>
            </View>

            {domainStatus && (
              <View style={[styles.statusBadge, isVerified ? styles.statusBadgeVerified : isPending ? styles.statusBadgePending : styles.statusBadgeError]}>
                <Ionicons
                  name={isVerified ? "checkmark-circle" : isPending ? "time" : "alert-circle"}
                  size={18}
                  color={isVerified ? Colors.success : isPending ? Colors.warning : Colors.error}
                />
                <Text style={[styles.statusBadgeText, isVerified ? styles.statusTextVerified : isPending ? styles.statusTextPending : styles.statusTextError]}>
                  {isVerified ? "Verified" : isPending ? "Pending" : "Not Registered"}
                </Text>
              </View>
            )}

            {domainStatus?.message && (
              <Text style={styles.statusMessage}>{domainStatus.message}</Text>
            )}

            {errorMessage && !accessDenied && (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={16} color={Colors.error} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <Pressable
              style={[styles.actionBtn, statusLoading && styles.actionBtnDisabled]}
              onPress={() => refetchDomainStatus()}
              disabled={statusLoading}
              testID="check-status-btn"
            >
              {statusLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="refresh" size={16} color="#fff" />
              )}
              <Text style={styles.actionBtnText}>Check Status</Text>
            </Pressable>
          </View>
        </Animated.View>

        {domainStatus && (
          <>
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="globe" size={18} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>DNS Verification</Text>
                  {recheckLoading && (
                    <View style={styles.checkingRow}>
                      <ActivityIndicator size="small" color={Colors.primary} />
                      <Text style={styles.checkingText}>Checking…</Text>
                    </View>
                  )}
                </View>

                {domainStatus.dns_records_needed && domainStatus.dns_records_needed.length > 0 && (
                  <View style={styles.dnsRecordsBox}>
                    <Text style={styles.dnsRecordsLabel}>DNS records required:</Text>
                    {domainStatus.dns_records_needed.map((rec, i) => (
                      <View key={i} style={styles.dnsRecord}>
                        <View style={styles.dnsRecordRow}>
                          <Text style={styles.dnsRecordType}>{rec.type}</Text>
                          <View style={[styles.dnsStatusPill, rec.status === "verified" ? styles.dnsStatusVerified : styles.dnsStatusPending]}>
                            <Text style={[styles.dnsStatusText, rec.status === "verified" ? styles.dnsStatusTextVerified : styles.dnsStatusTextPending]}>
                              {rec.status}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.dnsRecordName} numberOfLines={2}>{rec.name}</Text>
                        <Text style={styles.dnsRecordValue} numberOfLines={3}>{rec.value}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {isVerified && (
                  <Text style={styles.verifiedNote}>Domain is fully verified — no DNS action needed.</Text>
                )}

                {isNotRegistered && (
                  <Text style={styles.notRegisteredNote}>Domain has not been added to Resend yet.</Text>
                )}

                <Pressable
                  style={[styles.actionBtn, styles.actionBtnSecondary, recheckLoading && styles.actionBtnDisabled]}
                  onPress={recheckDNS}
                  disabled={recheckLoading}
                  testID="recheck-dns-btn"
                >
                  {recheckLoading ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Ionicons name="reload" size={16} color={Colors.primary} />
                  )}
                  <Text style={styles.actionBtnSecondaryText}>Re-check DNS</Text>
                </Pressable>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(150).duration(400)}>
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="send" size={18} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>Send Test Email</Text>
                </View>

                <Text style={styles.fieldLabel}>Recipient</Text>
                <TextInput
                  style={styles.emailInput}
                  value={testEmailTo}
                  onChangeText={setTestEmailTo}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="test-email-input"
                />

                {lastTestResult && (
                  <View style={styles.successBox}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={styles.successText}>{lastTestResult}</Text>
                  </View>
                )}

                <Pressable
                  style={[styles.actionBtn, testEmailLoading && styles.actionBtnDisabled]}
                  onPress={sendTestEmail}
                  disabled={testEmailLoading}
                  testID="send-test-email-btn"
                >
                  {testEmailLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={16} color="#fff" />
                  )}
                  <Text style={styles.actionBtnText}>Send Test Email</Text>
                </Pressable>
              </View>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: {
    fontFamily: "Rubik_700Bold",
    fontSize: 22,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  statusBadgeVerified: {
    backgroundColor: `${Colors.success}18`,
    borderWidth: 1,
    borderColor: `${Colors.success}40`,
  },
  statusBadgePending: {
    backgroundColor: `${Colors.warning}18`,
    borderWidth: 1,
    borderColor: `${Colors.warning}40`,
  },
  statusBadgeError: {
    backgroundColor: `${Colors.error}18`,
    borderWidth: 1,
    borderColor: `${Colors.error}40`,
  },
  statusBadgeText: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 14,
  },
  statusTextVerified: { color: Colors.success },
  statusTextPending: { color: Colors.warning },
  statusTextError: { color: Colors.error },
  statusMessage: {
    fontFamily: "Rubik_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: `${Colors.error}15`,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    fontFamily: "Rubik_400Regular",
    fontSize: 13,
    color: Colors.error,
    flex: 1,
    lineHeight: 18,
  },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: `${Colors.success}15`,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  successText: {
    fontFamily: "Rubik_400Regular",
    fontSize: 13,
    color: Colors.success,
    flex: 1,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  actionBtnSecondary: {
    backgroundColor: `${Colors.primary}15`,
    borderWidth: 1,
    borderColor: `${Colors.primary}40`,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
  actionBtnSecondaryText: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 14,
    color: Colors.primary,
  },
  dnsRecordsBox: {
    marginBottom: 14,
  },
  dnsRecordsLabel: {
    fontFamily: "Rubik_500Medium",
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dnsRecord: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dnsRecordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  dnsRecordType: {
    fontFamily: "Rubik_700Bold",
    fontSize: 12,
    color: Colors.text,
    letterSpacing: 1,
  },
  dnsStatusPill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dnsStatusVerified: {
    backgroundColor: `${Colors.success}20`,
  },
  dnsStatusPending: {
    backgroundColor: `${Colors.warning}20`,
  },
  dnsStatusText: {
    fontFamily: "Rubik_500Medium",
    fontSize: 11,
  },
  dnsStatusTextVerified: { color: Colors.success },
  dnsStatusTextPending: { color: Colors.warning },
  dnsRecordName: {
    fontFamily: "Rubik_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 3,
  },
  dnsRecordValue: {
    fontFamily: "Rubik_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
  },
  verifiedNote: {
    fontFamily: "Rubik_400Regular",
    fontSize: 13,
    color: Colors.success,
    marginBottom: 14,
  },
  notRegisteredNote: {
    fontFamily: "Rubik_400Regular",
    fontSize: 13,
    color: Colors.warning,
    marginBottom: 14,
  },
  fieldLabel: {
    fontFamily: "Rubik_500Medium",
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emailInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Rubik_400Regular",
    fontSize: 14,
    color: Colors.text,
    marginBottom: 14,
  },
  checkingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: "auto",
  },
  checkingText: {
    fontFamily: "Rubik_400Regular",
    fontSize: 12,
    color: Colors.primary,
  },
  accessDeniedTitle: {
    fontFamily: "Rubik_700Bold",
    fontSize: 22,
    color: Colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  accessDeniedSub: {
    fontFamily: "Rubik_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 40,
  },
});

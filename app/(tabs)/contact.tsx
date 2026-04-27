import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn, FadeOut } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { apiRequest, queryClient } from "@/lib/query-client";
import { useQuery } from "@tanstack/react-query";

interface FeedbackRow {
  id: string;
  userId: string;
  date: string;
  selection: string;
  category: string;
  submission: string;
}

const SELECTIONS = ["Exercise Request", "App Functionality", "General Feedback"] as const;
type Selection = (typeof SELECTIONS)[number];

const CATEGORIES: Record<Selection, string[]> = {
  "Exercise Request": ["Weights", "Circuit", "Yoga", "Cardio", "Mobility"],
  "App Functionality": ["Workout Structure", "Feature Problems", "Profile Issues"],
  "General Feedback": [],
};

const SUBMISSION_LIMIT: Record<Selection, number | null> = {
  "Exercise Request": 40,
  "App Functionality": null,
  "General Feedback": null,
};

function DropdownRow({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        style={styles.dropdownButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setOpen((p) => !p);
        }}
      >
        <Text style={[styles.dropdownText, !value && { color: Colors.textMuted }]}>
          {value || `Select ${label}`}
        </Text>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={Colors.textMuted}
        />
      </Pressable>
      {open && (
        <View style={styles.dropdownList}>
          {options.map((opt) => (
            <Pressable
              key={opt}
              style={[styles.dropdownOption, value === opt && styles.dropdownOptionSelected]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(opt);
                setOpen(false);
              }}
            >
              <Text
                style={[
                  styles.dropdownOptionText,
                  value === opt && { color: Colors.primary },
                ]}
              >
                {opt}
              </Text>
              {value === opt && (
                <Ionicons name="checkmark" size={16} color={Colors.primary} />
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function FeedbackSheet({
  onClose,
  onSubmitSuccess,
}: {
  onClose: () => void;
  onSubmitSuccess: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [selection, setSelection] = useState<Selection | "">("");
  const [category, setCategory] = useState("");
  const [submission, setSubmission] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const sel = selection as Selection;
  const categories = sel ? CATEGORIES[sel] : [];
  const limit = sel ? SUBMISSION_LIMIT[sel] : null;
  const isGeneralFeedback = sel === "General Feedback";

  const handleSelectionChange = (val: string) => {
    setSelection(val as Selection);
    setCategory(val === "General Feedback" ? "General Feedback" : "");
    setSubmission("");
    setError("");
  };

  const canSubmit =
    !!selection &&
    !!category &&
    submission.trim().length > 0 &&
    (limit === null || submission.length <= limit);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    setError("");
    try {
      await apiRequest("POST", "/api/feedback", {
        selection,
        category,
        submission: submission.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      onSubmitSuccess();
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={[styles.sheet, { paddingBottom: insets.bottom + 32 }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Send Feedback</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
            <Ionicons name="close" size={22} color={Colors.textMuted} />
          </Pressable>
        </View>
        <Text style={styles.sheetSubtitle}>
          Help us improve Swole House. Every submission is read by the team.
        </Text>

        <DropdownRow
          label="Type"
          value={selection}
          options={[...SELECTIONS]}
          onSelect={handleSelectionChange}
        />

        {sel && !isGeneralFeedback && categories.length > 0 && (
          <DropdownRow
            label="Category"
            value={category}
            options={categories}
            onSelect={setCategory}
          />
        )}

        {isGeneralFeedback && (
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.staticCategory}>
              <Text style={styles.staticCategoryText}>General Feedback</Text>
            </View>
          </View>
        )}

        {sel && (
          <View style={styles.fieldBlock}>
            <View style={styles.labelRow}>
              <Text style={styles.fieldLabel}>Submission</Text>
              {limit !== null && (
                <Text
                  style={[
                    styles.charCount,
                    submission.length > limit && { color: Colors.error },
                  ]}
                >
                  {submission.length}/{limit}
                </Text>
              )}
            </View>
            <TextInput
              style={[styles.textInput, { minHeight: sel === "Exercise Request" ? 56 : 120 }]}
              value={submission}
              onChangeText={(t) => {
                if (limit !== null && t.length > limit) return;
                setSubmission(t);
              }}
              placeholder={
                sel === "Exercise Request"
                  ? "e.g. Romanian deadlift, face pulls..."
                  : "Describe your feedback in detail..."
              }
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={limit ?? undefined}
              textAlignVertical="top"
            />
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Feedback</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return isoDate;
  }
}

function SubmissionCard({ item }: { item: FeedbackRow }) {
  return (
    <View style={styles.submissionCard}>
      <View style={styles.submissionHeader}>
        <View style={styles.submissionBadge}>
          <Text style={styles.submissionBadgeText}>{item.selection}</Text>
        </View>
        <Text style={styles.submissionDate}>{formatDate(item.date)}</Text>
      </View>
      <Text style={styles.submissionCategory}>{item.category}</Text>
      <Text style={styles.submissionText} numberOfLines={2}>{item.submission}</Text>
    </View>
  );
}

function MySubmissions() {
  const { data, isLoading, isError } = useQuery<{ feedback: FeedbackRow[] }>({
    queryKey: ["/api/feedback"],
    staleTime: 5 * 60 * 1000, // 5 minutes — also invalidated immediately after submission
  });

  const submissions = data?.feedback ?? [];

  return (
    <View style={styles.submissionsSection}>
      <Text style={styles.submissionsSectionTitle}>My Submissions</Text>
      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 12 }} />
      ) : isError ? (
        <View style={styles.submissionsEmpty}>
          <Ionicons name="alert-circle-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.submissionsEmptyText}>Could not load history</Text>
          <Text style={styles.submissionsEmptySubtext}>
            Pull down to refresh or try again later.
          </Text>
        </View>
      ) : submissions.length === 0 ? (
        <View style={styles.submissionsEmpty}>
          <Ionicons name="chatbubble-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.submissionsEmptyText}>No submissions yet</Text>
          <Text style={styles.submissionsEmptySubtext}>
            Your feedback history will appear here after you submit.
          </Text>
        </View>
      ) : (
        submissions.map((item) => <SubmissionCard key={item.id} item={item} />)
      )}
    </View>
  );
}

function SuccessBanner() {
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
      style={styles.successBanner}
    >
      <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
      <Text style={styles.successBannerText}>
        Thank you! We've received your feedback.
      </Text>
    </Animated.View>
  );
}

export default function ContactScreen() {
  const insets = useSafeAreaInsets();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  const webTopPad = Platform.OS === "web" ? 67 : 0;
  const webBottomPad = Platform.OS === "web" ? 34 : 0;

  const handleSubmitSuccess = () => {
    setShowBanner(true);
  };

  useEffect(() => {
    if (!showBanner) return;
    const timer = setTimeout(() => setShowBanner(false), 3500);
    return () => clearTimeout(timer);
  }, [showBanner]);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + webTopPad,
        },
      ]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.inner, { paddingBottom: insets.bottom + webBottomPad + 24 }]}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={styles.heroSection}>
          <View style={styles.heroIcon}>
            <Ionicons name="mail" size={44} color={Colors.primary} />
          </View>
          <Text style={styles.heading}>Contact Us</Text>
          <Text style={styles.subheading}>
            We want to hear from you. Request exercises, report issues, or share
            your thoughts — everything helps us build a better app.
          </Text>

          {showBanner && <SuccessBanner />}

          <Pressable
            style={styles.feedbackButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setSheetVisible(true);
            }}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color="#FFF" style={{ marginRight: 10 }} />
            <Text style={styles.feedbackButtonText}>Send Feedback</Text>
          </Pressable>

          <MySubmissions />

          <View style={styles.infoCards}>
            <Animated.View entering={FadeInDown.delay(100).duration(350)} style={styles.infoCard}>
              <Ionicons name="barbell" size={24} color={Colors.primary} />
              <Text style={styles.infoCardTitle}>Exercise Requests</Text>
              <Text style={styles.infoCardBody}>
                Want a specific movement added? Submit it and we{"'"}ll prioritise the most-requested exercises.
              </Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(180).duration(350)} style={styles.infoCard}>
              <Ionicons name="construct" size={24} color={Colors.yoga} />
              <Text style={styles.infoCardTitle}>App Feedback</Text>
              <Text style={styles.infoCardBody}>
                Found a bug or have an idea? Let us know and we{"'"}ll get right on it.
              </Text>
            </Animated.View>
          </View>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={sheetVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSheetVisible(false)}
      >
        <View style={styles.modalBackground}>
          <FeedbackSheet
            onClose={() => setSheetVisible(false)}
            onSubmitSuccess={handleSubmitSuccess}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  heroSection: {
    alignItems: "center",
  },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: `${Colors.primary}18`,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  heading: {
    fontFamily: "Rubik_700Bold",
    fontSize: 28,
    color: Colors.text,
    marginBottom: 12,
    textAlign: "center",
  },
  subheading: {
    fontFamily: "Rubik_400Regular",
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    maxWidth: 320,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${Colors.success}20`,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: `${Colors.success}40`,
    width: "100%",
  },
  successBannerText: {
    fontFamily: "Rubik_500Medium",
    fontSize: 14,
    color: Colors.success,
    flex: 1,
  },
  feedbackButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginBottom: 36,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  feedbackButtonText: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 16,
    color: "#FFF",
  },
  infoCards: {
    width: "100%",
    gap: 12,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  infoCardTitle: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  infoCardBody: {
    fontFamily: "Rubik_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  sheet: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sheetTitle: {
    fontFamily: "Rubik_700Bold",
    fontSize: 22,
    color: Colors.text,
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  sheetSubtitle: {
    fontFamily: "Rubik_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    paddingHorizontal: 20,
    marginBottom: 24,
    lineHeight: 20,
  },
  fieldBlock: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  fieldLabel: {
    fontFamily: "Rubik_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dropdownText: {
    fontFamily: "Rubik_400Regular",
    fontSize: 15,
    color: Colors.text,
  },
  dropdownList: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  dropdownOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownOptionSelected: {
    backgroundColor: `${Colors.primary}15`,
  },
  dropdownOptionText: {
    fontFamily: "Rubik_400Regular",
    fontSize: 15,
    color: Colors.text,
  },
  staticCategory: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  staticCategoryText: {
    fontFamily: "Rubik_400Regular",
    fontSize: 15,
    color: Colors.textMuted,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  charCount: {
    fontFamily: "Rubik_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontFamily: "Rubik_400Regular",
    fontSize: 15,
    lineHeight: 21,
  },
  errorText: {
    fontFamily: "Rubik_400Regular",
    fontSize: 14,
    color: Colors.error,
    marginHorizontal: 20,
    marginBottom: 12,
    textAlign: "center",
  },
  submitButton: {
    backgroundColor: Colors.primary,
    marginHorizontal: 20,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.surfaceHighlight,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 16,
    color: "#FFF",
  },
  submissionsSection: {
    marginTop: 32,
    width: "100%",
  },
  submissionsSectionTitle: {
    fontFamily: "Rubik_700Bold",
    fontSize: 18,
    color: Colors.text,
    marginBottom: 14,
  },
  submissionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
    gap: 6,
  },
  submissionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  submissionBadge: {
    backgroundColor: `${Colors.primary}20`,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  submissionBadgeText: {
    fontFamily: "Rubik_500Medium",
    fontSize: 11,
    color: Colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  submissionDate: {
    fontFamily: "Rubik_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  submissionCategory: {
    fontFamily: "Rubik_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  submissionText: {
    fontFamily: "Rubik_400Regular",
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  submissionsEmpty: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  submissionsEmptyText: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  submissionsEmptySubtext: {
    fontFamily: "Rubik_400Regular",
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 19,
  },
});

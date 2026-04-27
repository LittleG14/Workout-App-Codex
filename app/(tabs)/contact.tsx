import React, { useState } from "react";
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
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";

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

function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [selection, setSelection] = useState<Selection | "">("");
  const [category, setCategory] = useState("");
  const [submission, setSubmission] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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
      setSubmitted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError("Something went wrong. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Thank You!</Text>
          <Text style={styles.successBody}>
            Your feedback has been received. We review every submission and use
            them to shape future updates.
          </Text>
          <Pressable style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={styles.sheet}
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

export default function ContactScreen() {
  const insets = useSafeAreaInsets();
  const [sheetVisible, setSheetVisible] = useState(false);

  const webTopPad = Platform.OS === "web" ? 67 : 0;
  const webBottomPad = Platform.OS === "web" ? 34 : 0;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + webTopPad,
          paddingBottom: webBottomPad,
        },
      ]}
    >
      <Animated.View entering={FadeInDown.duration(400)} style={styles.inner}>
        <View style={styles.heroIcon}>
          <Ionicons name="mail" size={44} color={Colors.primary} />
        </View>
        <Text style={styles.heading}>Contact Us</Text>
        <Text style={styles.subheading}>
          We want to hear from you. Request exercises, report issues, or share
          your thoughts — everything helps us build a better app.
        </Text>

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

        <View style={styles.infoCards}>
          <Animated.View entering={FadeInDown.delay(100).duration(350)} style={styles.infoCard}>
            <Ionicons name="barbell" size={24} color={Colors.primary} />
            <Text style={styles.infoCardTitle}>Exercise Requests</Text>
            <Text style={styles.infoCardBody}>
              Want a specific movement added? Submit it and we'll prioritise the most-requested exercises.
            </Text>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(180).duration(350)} style={styles.infoCard}>
            <Ionicons name="construct" size={24} color={Colors.yoga} />
            <Text style={styles.infoCardTitle}>App Feedback</Text>
            <Text style={styles.infoCardBody}>
              Found a bug or have an idea? Let us know and we'll get right on it.
            </Text>
          </Animated.View>
        </View>
      </Animated.View>

      <Modal
        visible={sheetVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSheetVisible(false)}
      >
        <View style={styles.modalBackground}>
          <FeedbackSheet onClose={() => setSheetVisible(false)} />
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
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
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
    marginBottom: 32,
    maxWidth: 320,
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
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontFamily: "Rubik_700Bold",
    fontSize: 28,
    color: Colors.text,
    marginBottom: 16,
  },
  successBody: {
    fontFamily: "Rubik_400Regular",
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 40,
  },
  doneButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
  },
  doneButtonText: {
    fontFamily: "Rubik_600SemiBold",
    fontSize: 16,
    color: "#FFF",
  },
});

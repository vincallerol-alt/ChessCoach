import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import { OptionChip } from "../components/OptionChip";
import { colors, radius, shadow } from "../design/theme";
import {
  defaultParentConfig,
  Lesson,
  lessonLabels,
  ParentConfig,
  StoryDuration,
  Theme,
  themeLabels,
  VoiceStyle,
} from "../domain/types";

interface ParentSetupScreenProps {
  initialConfig: ParentConfig;
  onStart: (config: ParentConfig) => void;
}

const allThemes = Object.keys(themeLabels) as Theme[];
const allLessons = Object.keys(lessonLabels) as Lesson[];

export function ParentSetupScreen({ initialConfig, onStart }: ParentSetupScreenProps) {
  const [config, setConfig] = useState<ParentConfig>(initialConfig || defaultParentConfig);
  const [blockedText, setBlockedText] = useState(config.blockedTopics.join(", "));

  function toggleTheme(theme: Theme) {
    setConfig((current) => ({
      ...current,
      allowedThemes: current.allowedThemes.includes(theme)
        ? current.allowedThemes.filter((item) => item !== theme)
        : [...current.allowedThemes, theme],
    }));
  }

  function toggleLesson(lesson: Lesson) {
    setConfig((current) => ({
      ...current,
      lessons: current.lessons.includes(lesson)
        ? current.lessons.filter((item) => item !== lesson)
        : [...current.lessons, lesson],
    }));
  }

  function submit() {
    onStart({
      ...config,
      blockedTopics: blockedText
        .split(",")
        .map((topic) => topic.trim())
        .filter(Boolean),
      childAge: clamp(config.childAge, 4, 8),
      allowedThemes: config.allowedThemes.length > 0 ? config.allowedThemes : ["friendship"],
    });
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#FFF7EA", "#FFE5DC", "#DCEBFF"]} style={styles.hero}>
          <View style={styles.brandRow}>
            <View style={styles.logoMark}>
              <Ionicons name="moon" size={18} color={colors.greenDark} />
            </View>
            <Text style={styles.brand}>SauveParent</Text>
          </View>
          <Text style={styles.title}>Un moment calme, cadre par le parent</Text>
          <Text style={styles.intro}>
            Reglez l'age, le ton et les sujets. L'enfant gardera l'impression de jouer, l'agent gardera le cadre.
          </Text>
          <View style={styles.promiseRow}>
            <Promise icon="shield-checkmark-outline" label="Age parent prioritaire" />
            <Promise icon="mic-outline" label="Audio-first" />
            <Promise icon="heart-outline" label="Educatif doux" />
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <SectionHeader icon="person-outline" title="Profil enfant" detail="La base de securite de la session." />
          <View style={styles.field}>
            <Text style={styles.label}>Prenom</Text>
            <TextInput
              value={config.childName}
              onChangeText={(childName) => setConfig((current) => ({ ...current, childName }))}
              placeholder="Optionnel"
              placeholderTextColor="#8A958F"
              style={styles.input}
              maxLength={24}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.rowItem]}>
              <Text style={styles.label}>Age reel</Text>
              <TextInput
                value={String(config.childAge)}
                onChangeText={(value) => setConfig((current) => ({ ...current, childAge: Number(value) || 4 }))}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>

            <View style={[styles.field, styles.rowItem]}>
              <Text style={styles.label}>Duree</Text>
              <View style={styles.chipRow}>
                {[5, 10, 15].map((duration) => (
                  <OptionChip
                    key={duration}
                    label={`${duration} min`}
                    selected={config.duration === duration}
                    onPress={() => setConfig((current) => ({ ...current, duration: duration as StoryDuration }))}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader icon="sparkles-outline" title="Style de l'histoire" detail="Assez expressif pour l'enfant, assez fiable pour le parent." />
          <Text style={styles.label}>Voix</Text>
          <View style={styles.chipRow}>
            {(["soft", "funny"] as VoiceStyle[]).map((voiceStyle) => (
              <OptionChip
                key={voiceStyle}
                label={voiceStyle === "soft" ? "Douce" : "Rigolote"}
                selected={config.voiceStyle === voiceStyle}
                onPress={() => setConfig((current) => ({ ...current, voiceStyle }))}
              />
            ))}
          </View>

          <Text style={styles.label}>Themes autorises</Text>
          <View style={styles.chipRow}>
            {allThemes.map((theme) => (
              <OptionChip
                key={theme}
                label={themeLabels[theme]}
                selected={config.allowedThemes.includes(theme)}
                onPress={() => toggleTheme(theme)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader icon="school-outline" title="Education subtile" detail="Jamais scolaire, toujours integre dans l'histoire." />
          <View style={styles.chipRow}>
            {allLessons.map((lesson) => (
              <OptionChip
                key={lesson}
                label={lessonLabels[lesson]}
                selected={config.lessons.includes(lesson)}
                onPress={() => toggleLesson(lesson)}
              />
            ))}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Sujets interdits</Text>
            <TextInput
              value={blockedText}
              onChangeText={setBlockedText}
              placeholder="Ex : monstres realistes, violence, separation"
              placeholderTextColor="#8A958F"
              style={[styles.input, styles.textarea]}
              multiline
            />
          </View>
        </View>

        <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} onPress={submit}>
          <Text style={styles.primaryButtonText}>Demarrer la session enfant</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.surface} />
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Promise({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.promise}>
      <Ionicons name={icon} size={16} color={colors.greenDark} />
      <Text style={styles.promiseText}>{label}</Text>
    </View>
  );
}

function SectionHeader({ icon, title, detail }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={18} color={colors.green} />
      </View>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionDetail}>{detail}</Text>
      </View>
    </View>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    padding: 18,
    gap: 14,
    paddingBottom: 28,
  },
  hero: {
    borderRadius: radius.lg,
    padding: 22,
    gap: 14,
    overflow: "hidden",
    ...shadow,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  brand: {
    color: colors.greenDark,
    fontSize: 15,
    fontWeight: "900",
  },
  title: {
    color: colors.ink,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
  },
  intro: {
    color: colors.softText,
    fontSize: 16,
    lineHeight: 23,
  },
  promiseRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  promise: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.64)",
  },
  promiseText: {
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: "800",
  },
  section: {
    borderRadius: radius.md,
    padding: 16,
    gap: 14,
    backgroundColor: colors.surface,
    ...shadow,
  },
  sectionHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mint,
  },
  sectionCopy: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  sectionDetail: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  rowItem: {
    flex: 1,
  },
  field: {
    gap: 8,
  },
  label: {
    color: "#31413B",
    fontSize: 14,
    fontWeight: "900",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: 13,
    backgroundColor: "#FBFAF7",
    color: colors.ink,
    fontSize: 16,
  },
  textarea: {
    minHeight: 84,
    textAlignVertical: "top",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryButton: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: radius.md,
    backgroundColor: colors.green,
    padding: 16,
    ...shadow,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "900",
  },
});

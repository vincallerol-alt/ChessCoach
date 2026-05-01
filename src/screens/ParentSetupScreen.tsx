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

import { OptionChip } from "../components/OptionChip";
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
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>SauveParent MVP</Text>
        <Text style={styles.title}>Configurer le cadre parent</Text>
        <Text style={styles.intro}>
          L'age parent reste la source de verite. L'agent pourra demander son age a l'enfant, mais adaptera toujours le contenu au cadre configure ici.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Prenom de l'enfant</Text>
          <TextInput
            value={config.childName}
            onChangeText={(childName) => setConfig((current) => ({ ...current, childName }))}
            placeholder="Optionnel"
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

        <View style={styles.field}>
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
        </View>

        <View style={styles.field}>
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

        <View style={styles.field}>
          <Text style={styles.label}>Apprentissages legers</Text>
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
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Sujets interdits</Text>
          <TextInput
            value={blockedText}
            onChangeText={setBlockedText}
            placeholder="Ex : monstres realistes, violence, separation"
            style={[styles.input, styles.textarea]}
            multiline
          />
        </View>

        <Pressable style={styles.primaryButton} onPress={submit}>
          <Text style={styles.primaryButtonText}>Demarrer la session enfant</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF7EA",
  },
  content: {
    padding: 24,
    gap: 18,
  },
  eyebrow: {
    color: "#63746D",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: "#17211D",
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "900",
  },
  intro: {
    color: "#52605B",
    fontSize: 16,
    lineHeight: 23,
  },
  row: {
    flexDirection: "row",
    gap: 14,
  },
  rowItem: {
    flex: 1,
  },
  field: {
    gap: 8,
  },
  label: {
    color: "#31413B",
    fontSize: 15,
    fontWeight: "800",
  },
  input: {
    borderWidth: 1,
    borderColor: "#C9BFAE",
    borderRadius: 8,
    padding: 13,
    backgroundColor: "#FFFFFF",
    color: "#17211D",
    fontSize: 16,
  },
  textarea: {
    minHeight: 82,
    textAlignVertical: "top",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#176B5B",
    padding: 16,
    marginTop: 6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
});

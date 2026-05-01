import React, { useMemo, useState } from "react";
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

import { colors, radius, shadow } from "../design/theme";
import { checkChildInputSafety, sanitizeChildInput } from "../domain/safety";
import {
  buildAgeReply,
  buildParentSummary,
  buildPoliteBridge,
  buildStory,
  childPrompts,
} from "../domain/storyEngine";
import { ParentConfig, SessionAnswers, SessionPhase } from "../domain/types";
import { speak, stopSpeaking } from "../services/voice";

const firstPrompt = childPrompts[0]!;

interface ChildSessionScreenProps {
  title: string;
  config: ParentConfig;
  onBackToParent: () => void;
}

export function ChildSessionScreen({ title, config, onBackToParent }: ChildSessionScreenProps) {
  const [phase, setPhase] = useState<SessionPhase>("intro");
  const [promptIndex, setPromptIndex] = useState(0);
  const [agentLine, setAgentLine] = useState(firstPrompt.text);
  const [input, setInput] = useState("");
  const [answers, setAnswers] = useState<SessionAnswers>({});
  const [alerts, setAlerts] = useState<string[]>([]);

  const summary = useMemo(() => buildParentSummary(config, answers, alerts), [alerts, answers, config]);
  const currentPrompt = childPrompts[promptIndex];

  function say(text: string) {
    setAgentLine(text);
    speak(text, config.voiceStyle);
  }

  function startIntro() {
    setPhase("questioning");
    setPromptIndex(0);
    say(firstPrompt.text);
  }

  function submitChildInput() {
    if (!currentPrompt || phase === "stopped") return;

    stopSpeaking();
    const cleanInput = sanitizeChildInput(input);
    if (!cleanInput) return;

    const safety = checkChildInputSafety(cleanInput, config);
    if (!safety.safe) {
      setAlerts((current) => [...current, `Demande transformee : ${safety.reason}`]);
      say(safety.childFriendlyReply || "On transforme cette idee en version plus douce.");
      setInput("");
      return;
    }

    const nextAnswers = { ...answers, [currentPrompt.key]: cleanInput };
    setAnswers(nextAnswers);
    setInput("");

    if (currentPrompt.key === "childAgeAnswer") {
      const nextIndex = promptIndex + 1;
      const nextPrompt = childPrompts[nextIndex];
      if (!nextPrompt) return;
      setPromptIndex(nextIndex);
      say(`${buildAgeReply(cleanInput, config.childAge)} ${nextPrompt.text}`);
      return;
    }

    const nextIndex = promptIndex + 1;
    const nextPrompt = childPrompts[nextIndex];
    if (nextPrompt) {
      setPromptIndex(nextIndex);
      say(`${buildPoliteBridge(cleanInput, config)} ${nextPrompt.text}`);
      return;
    }

    setPhase("ready");
    say("Merci pour toutes tes idees. J'ai prepare ton histoire. Quand tu veux, on la lance.");
  }

  function startStory() {
    const story = buildStory(config, answers);
    setPhase("story");
    say(story);
  }

  function stopSession() {
    stopSpeaking();
    setPhase("stopped");
    setAgentLine("D'accord, pause immediate. Le parent reprend la main.");
  }

  function interrupt() {
    stopSpeaking();
    if (phase === "intro") {
      startIntro();
      return;
    }
    setAgentLine("Je t'ecoute. Ajoute ton idee, et je reprends avec toi.");
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <LinearGradient colors={["#E9F3EF", "#DCEBFF", "#FFF7EA"]} style={styles.backdrop}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>{title}</Text>
              <Text style={styles.title}>Pret pour l'histoire</Text>
            </View>
            <Pressable accessibilityLabel="Retour parent" style={styles.iconButton} onPress={onBackToParent}>
              <Ionicons name="settings-outline" size={22} color={colors.green} />
            </Pressable>
          </View>

          <View style={styles.stage}>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, phase === "story" && styles.statusDotLive]} />
              <Text style={styles.statusText}>{statusLabel(phase)}</Text>
            </View>

            <View style={styles.orbit}>
              <View style={styles.face} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <View style={styles.eye} />
                <View style={styles.mouth} />
                <View style={styles.eye} />
              </View>
            </View>

            <View style={styles.agentBubble}>
              <Text style={styles.agentLine}>{agentLine}</Text>
            </View>
          </View>

          <View style={styles.primaryControls}>
            <Pressable style={({ pressed }) => [styles.micButton, pressed && styles.pressed]} onPress={interrupt}>
              <Ionicons name={phase === "intro" ? "play" : "mic"} size={24} color={colors.greenDark} />
              <Text style={styles.micText}>{phase === "intro" ? "Commencer" : "Interrompre"}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.storyButton,
                phase !== "ready" && styles.disabled,
                pressed && phase === "ready" && styles.pressed,
              ]}
              disabled={phase !== "ready"}
              onPress={startStory}
            >
              <Ionicons name="book-outline" size={19} color={colors.surface} />
              <Text style={styles.storyText}>Lancer l'histoire</Text>
            </Pressable>
          </View>

          <View style={styles.fallbackPanel}>
            <View style={styles.fallbackHeader}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.green} />
              <Text style={styles.fallbackTitle}>Saisie temporaire MVP</Text>
            </View>
            <View style={styles.inputRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Ex : j'ai 42 ans et je veux un dragon gentil"
                placeholderTextColor="#8A958F"
                style={styles.input}
                onSubmitEditing={submitChildInput}
                returnKeyType="send"
              />
              <Pressable style={styles.sendButton} onPress={submitChildInput}>
                <Ionicons name="send" size={18} color={colors.surface} />
              </Pressable>
            </View>
          </View>

          <View style={styles.parentBar}>
            <Pressable style={({ pressed }) => [styles.stopButton, pressed && styles.pressed]} onPress={stopSession}>
              <Ionicons name="stop-circle-outline" size={18} color={colors.surface} />
              <Text style={styles.stopText}>Stop parent</Text>
            </Pressable>
            <Text style={styles.parentHint}>Resume visible uniquement cote parent.</Text>
          </View>

          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>Resume parent</Text>
            <SummaryLine label="Scenario" value={summary.scenario} />
            <SummaryLine label="Themes" value={summary.themes.join(", ") || "-"} />
            <SummaryLine label="Alertes" value={summary.alerts.length > 0 ? summary.alerts.join(" | ") : "Aucune"} />
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function statusLabel(phase: SessionPhase) {
  if (phase === "intro") return "En attente";
  if (phase === "questioning") return "Discussion";
  if (phase === "ready") return "Scenario pret";
  if (phase === "story") return "Histoire en cours";
  return "Pause parent";
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.child,
  },
  backdrop: {
    flex: 1,
  },
  content: {
    alignItems: "center",
    gap: 16,
    padding: 18,
    paddingBottom: 28,
  },
  header: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: colors.ink,
    fontSize: 31,
    lineHeight: 35,
    fontWeight: "900",
  },
  iconButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.78)",
  },
  stage: {
    width: "100%",
    alignItems: "center",
    gap: 16,
    borderRadius: radius.lg,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.58)",
    ...shadow,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.sm,
    paddingHorizontal: 11,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  statusDotLive: {
    backgroundColor: colors.coral,
  },
  statusText: {
    color: colors.greenDark,
    fontSize: 12,
    fontWeight: "900",
  },
  orbit: {
    width: 246,
    height: 246,
    borderRadius: 123,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(23,107,91,0.18)",
    backgroundColor: "rgba(255,255,255,0.36)",
  },
  face: {
    width: 204,
    height: 204,
    borderRadius: 102,
    backgroundColor: colors.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
    ...shadow,
  },
  eye: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.ink,
  },
  mouth: {
    width: 54,
    height: 31,
    borderBottomWidth: 8,
    borderBottomColor: colors.ink,
    borderRadius: 28,
    marginTop: 48,
  },
  agentBubble: {
    width: "100%",
    minHeight: 124,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: 18,
    justifyContent: "center",
  },
  agentLine: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 28,
    textAlign: "center",
    fontWeight: "800",
  },
  primaryControls: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
  },
  micButton: {
    flex: 1,
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    ...shadow,
  },
  micText: {
    color: colors.greenDark,
    fontSize: 16,
    fontWeight: "900",
  },
  storyButton: {
    flex: 1,
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: radius.md,
    backgroundColor: colors.green,
    ...shadow,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
  storyText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
  },
  fallbackPanel: {
    width: "100%",
    gap: 10,
    borderRadius: radius.md,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  fallbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fallbackTitle: {
    color: colors.greenDark,
    fontWeight: "900",
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: 13,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 15,
  },
  sendButton: {
    width: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.sm,
    backgroundColor: colors.green,
  },
  parentBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  stopButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radius.sm,
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: "#A53D3D",
  },
  stopText: {
    color: colors.surface,
    fontWeight: "900",
  },
  parentHint: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "right",
    fontWeight: "700",
  },
  summary: {
    width: "100%",
    borderRadius: radius.md,
    padding: 16,
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.74)",
  },
  summaryTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  summaryLine: {
    flexDirection: "row",
    gap: 12,
  },
  summaryLabel: {
    width: 78,
    color: colors.muted,
    fontWeight: "900",
  },
  summaryValue: {
    flex: 1,
    color: colors.ink,
    fontWeight: "600",
  },
});

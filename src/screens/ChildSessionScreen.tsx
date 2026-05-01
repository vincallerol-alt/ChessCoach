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
import { Ionicons } from "@expo/vector-icons";

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
      const nextAlerts = [...alerts, `Demande transformee : ${safety.reason}`];
      setAlerts(nextAlerts);
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{title}</Text>
            <Text style={styles.title}>Agent babysitter</Text>
          </View>
          <Pressable accessibilityLabel="Retour parent" style={styles.iconButton} onPress={onBackToParent}>
            <Ionicons name="settings-outline" size={22} color="#176B5B" />
          </Pressable>
        </View>

        <View style={styles.face} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.eye} />
          <View style={styles.mouth} />
          <View style={styles.eye} />
        </View>

        <View style={styles.agentBubble}>
          <Text style={styles.agentLine}>{agentLine}</Text>
        </View>

        <View style={styles.controls}>
          <Pressable style={[styles.button, styles.listenButton]} onPress={interrupt}>
            <Ionicons name="mic-outline" size={18} color="#2B2417" />
            <Text style={styles.listenText}>{phase === "intro" ? "Commencer" : "Interrompre"}</Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.storyButton, phase !== "ready" && styles.disabled]}
            disabled={phase !== "ready"}
            onPress={startStory}
          >
            <Ionicons name="book-outline" size={18} color="#FFFFFF" />
            <Text style={styles.storyText}>Lancer l'histoire</Text>
          </Pressable>

          <Pressable style={[styles.button, styles.stopButton]} onPress={stopSession}>
            <Ionicons name="stop-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.stopText}>Stop parent</Text>
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Reponse enfant, en attendant le micro temps reel</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ex : j'ai 42 ans et je veux un dragon gentil"
              style={styles.input}
              onSubmitEditing={submitChildInput}
              returnKeyType="send"
            />
            <Pressable style={styles.sendButton} onPress={submitChildInput}>
              <Ionicons name="send" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Resume parent</Text>
          <SummaryLine label="Scenario" value={summary.scenario} />
          <SummaryLine label="Themes" value={summary.themes.join(", ") || "-"} />
          <SummaryLine label="Alertes" value={summary.alerts.length > 0 ? summary.alerts.join(" | ") : "Aucune"} />
        </View>
      </ScrollView>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E9F3EF",
  },
  content: {
    alignItems: "center",
    gap: 22,
    padding: 24,
  },
  header: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    fontSize: 32,
    fontWeight: "900",
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  face: {
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "#FFD166",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    shadowColor: "#17211D",
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 4,
  },
  eye: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#17211D",
  },
  mouth: {
    width: 58,
    height: 34,
    borderBottomWidth: 8,
    borderBottomColor: "#17211D",
    borderRadius: 28,
    marginTop: 54,
  },
  agentBubble: {
    width: "100%",
    minHeight: 116,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    padding: 18,
    justifyContent: "center",
  },
  agentLine: {
    color: "#17211D",
    fontSize: 20,
    lineHeight: 28,
    textAlign: "center",
    fontWeight: "700",
  },
  controls: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  listenButton: {
    backgroundColor: "#FFD166",
  },
  storyButton: {
    backgroundColor: "#176B5B",
  },
  stopButton: {
    backgroundColor: "#A53D3D",
  },
  disabled: {
    opacity: 0.45,
  },
  listenText: {
    color: "#2B2417",
    fontWeight: "900",
  },
  storyText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  stopText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  field: {
    width: "100%",
    gap: 8,
  },
  label: {
    color: "#31413B",
    fontWeight: "800",
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#C9BFAE",
    borderRadius: 8,
    padding: 13,
    backgroundColor: "#FFFFFF",
    color: "#17211D",
    fontSize: 15,
  },
  sendButton: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#176B5B",
  },
  summary: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "rgba(23, 33, 29, 0.16)",
    paddingTop: 16,
    gap: 10,
  },
  summaryTitle: {
    color: "#17211D",
    fontSize: 18,
    fontWeight: "900",
  },
  summaryLine: {
    flexDirection: "row",
    gap: 12,
  },
  summaryLabel: {
    width: 78,
    color: "#52605B",
    fontWeight: "900",
  },
  summaryValue: {
    flex: 1,
    color: "#17211D",
    fontWeight: "600",
  },
});

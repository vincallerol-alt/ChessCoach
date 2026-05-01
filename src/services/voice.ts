import * as Speech from "expo-speech";
import { VoiceStyle } from "../domain/types";

export function speak(text: string, voiceStyle: VoiceStyle) {
  Speech.stop();
  Speech.speak(text, {
    language: "fr-FR",
    rate: voiceStyle === "funny" ? 1.05 : 0.88,
    pitch: voiceStyle === "funny" ? 1.35 : 1.05,
  });
}

export function stopSpeaking() {
  Speech.stop();
}

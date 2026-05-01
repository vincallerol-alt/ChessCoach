export type VoiceStyle = "soft" | "funny";
export type StoryDuration = 5 | 10 | 15;
export type SessionPhase = "intro" | "questioning" | "ready" | "story" | "stopped";

export type Theme =
  | "emotions"
  | "friendship"
  | "sharing"
  | "ecology"
  | "sleep";

export type Lesson =
  | "politeness"
  | "sorry"
  | "patience"
  | "autonomy"
  | "empathy";

export interface ParentConfig {
  childName: string;
  childAge: number;
  duration: StoryDuration;
  voiceStyle: VoiceStyle;
  allowedThemes: Theme[];
  lessons: Lesson[];
  blockedTopics: string[];
}

export interface SessionAnswers {
  childAgeAnswer?: string;
  mood?: string;
  genre?: string;
  hero?: string;
}

export interface ParentSummary {
  scenario: string;
  themes: string[];
  alerts: string[];
}

export const defaultParentConfig: ParentConfig = {
  childName: "",
  childAge: 6,
  duration: 10,
  voiceStyle: "soft",
  allowedThemes: ["emotions", "friendship", "sharing", "sleep"],
  lessons: ["politeness", "sorry", "patience"],
  blockedTopics: [],
};

export const themeLabels: Record<Theme, string> = {
  emotions: "Emotions",
  friendship: "Amitie",
  sharing: "Partage",
  ecology: "Ecologie",
  sleep: "Sommeil",
};

export const lessonLabels: Record<Lesson, string> = {
  politeness: "Politesse",
  sorry: "Pardon",
  patience: "Patience",
  autonomy: "Autonomie",
  empathy: "Empathie",
};

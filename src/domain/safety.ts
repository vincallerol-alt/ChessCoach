import { ParentConfig } from "./types";

const sensitiveWords = [
  "sang",
  "tuer",
  "mourir",
  "arme",
  "cauchemar",
  "kidnapper",
  "horreur",
  "violence",
];

export interface SafetyResult {
  safe: boolean;
  reason?: string;
  childFriendlyReply?: string;
}

export function sanitizeChildInput(input: string) {
  return input.replace(/[<>]/g, "").trim().slice(0, 220);
}

export function checkChildInputSafety(input: string, config: ParentConfig): SafetyResult {
  const normalized = input.toLowerCase();
  const blocked = [...sensitiveWords, ...config.blockedTopics.map((topic) => topic.toLowerCase())];
  const hit = blocked.find((word) => word.length > 0 && normalized.includes(word));

  if (!hit) {
    return { safe: true };
  }

  return {
    safe: false,
    reason: hit,
    childFriendlyReply:
      "Cette idee est un peu trop forte pour notre histoire. On va la transformer en mystere rigolo, d'accord ?",
  };
}

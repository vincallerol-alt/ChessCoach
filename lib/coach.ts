import type { CoachNarrator, CoachPlanner, PlayerProfile, SkillArea, TrainingPlan, WeaknessSignal } from "./types";

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function weaknessPriority(signal: Omit<WeaknessSignal, "priority">): number {
  return Number((
    clamp(signal.recurrence) * 0.35 +
    clamp(signal.evaluationLoss) * 0.25 +
    clamp(signal.recency) * 0.2 +
    clamp(signal.timePressure) * 0.1 +
    clamp(signal.failedAttempts) * 0.1
  ).toFixed(4));
}

export function nextReviewDate(lastAttempt: Date, intervalDays: number, correct: boolean): Date {
  const next = new Date(lastAttempt);
  const days = correct ? Math.min(30, Math.max(1, intervalDays * 2)) : 1;
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export class AdaptiveCoachPlanner implements CoachPlanner {
  buildDailyPlan(profile: PlayerProfile, signals: WeaknessSignal[], date: Date): TrainingPlan {
    const focusSignal = [...signals].sort((a, b) => b.priority - a.priority)[0];
    const focus = focusSignal?.area ?? "tactics";
    const minutes = profile.dailyMinutes;
    return {
      id: `${profile.id}-${date.toISOString().slice(0, 10)}`,
      date: date.toISOString().slice(0, 10),
      durationMinutes: minutes,
      contentVersion: 2,
      focus,
      headline: focusSignal ? focusSignal.label : "Construire votre diagnostic de jeu",
      rationale: focusSignal
        ? `${focusSignal.label} est la priorité calculée à partir de vos données réelles.`
        : "Synchronisez Chess.com ou jouez une partie pour personnaliser cette séance.",
      steps: [
        { id: "replay", kind: "replay", title: "Rejouer une erreur personnelle", minutes: 4, completed: false },
        { id: "review", kind: "review", title: "Révision espacée · 1 position", minutes: 4, completed: false },
        { id: "exercise", kind: "exercise", title: "Série tactique · 3 positions", minutes: 5, completed: false },
        { id: "mini-game", kind: "mini-game", title: "Mini-partie sous pression", minutes: 5, completed: false },
        { id: "summary", kind: "summary", title: "Bilan et prochain rappel", minutes: 2, completed: false },
      ],
    };
  }
}

const messages: Record<SkillArea, string> = {
  openings: "Vérifie le développement, la sécurité du roi et le plan de pièces avant de mémoriser une nouvelle variante.",
  tactics: "Avant de jouer, balaie échecs, prises et menaces — pour toi comme pour l’adversaire.",
  strategy: "Ne cherche pas encore un coup. Nomme d’abord ta pire pièce et le pion faible que tu peux cibler.",
  endgames: "Avant de simplifier, compare l’activité des rois, la structure de pions et la création d’un pion passé.",
  time: "Sous 30 secondes, choisis entre deux candidats maximum et garde cinq secondes pour le contrôle tactique.",
};

export class DeterministicCoachNarrator implements CoachNarrator {
  explain(area: SkillArea, context: { move?: string; evaluationLoss?: number }): string {
    const suffix = context.evaluationLoss && context.evaluationLoss > 100
      ? " La perte est importante : rejoue la position sans moteur avant de lire la solution."
      : "";
    return messages[area] + suffix;
  }
}

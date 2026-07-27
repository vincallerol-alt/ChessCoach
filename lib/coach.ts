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

const baseSignals: Array<Omit<WeaknessSignal, "priority">> = [
  {
    id: "strategy-plan",
    area: "strategy",
    label: "Construire un plan en milieu de jeu",
    recurrence: 0.88,
    evaluationLoss: 0.72,
    recency: 0.92,
    timePressure: 0.58,
    failedAttempts: 0.44,
  },
  {
    id: "time-decisions",
    area: "time",
    label: "Décider sous pression",
    recurrence: 0.74,
    evaluationLoss: 0.56,
    recency: 0.86,
    timePressure: 0.95,
    failedAttempts: 0.34,
  },
  {
    id: "tactical-check",
    area: "tactics",
    label: "Vérification tactique avant de jouer",
    recurrence: 0.6,
    evaluationLoss: 0.68,
    recency: 0.66,
    timePressure: 0.62,
    failedAttempts: 0.5,
  },
];

export const defaultSignals: WeaknessSignal[] = baseSignals.map((signal) => ({
  ...signal,
  priority: weaknessPriority(signal),
}));

export class AdaptiveCoachPlanner implements CoachPlanner {
  buildDailyPlan(profile: PlayerProfile, signals: WeaknessSignal[], date: Date): TrainingPlan {
    const focusSignal = [...signals].sort((a, b) => b.priority - a.priority)[0] ?? defaultSignals[0];
    const minutes = profile.dailyMinutes;
    return {
      id: `${profile.id}-${date.toISOString().slice(0, 10)}`,
      date: date.toISOString().slice(0, 10),
      durationMinutes: minutes,
      focus: focusSignal.area,
      headline: "Transformer une position égale en plan clair",
      rationale: `${focusSignal.label} est aujourd’hui le levier le plus rentable pour viser ${profile.targetRating}.`,
      steps: [
        { id: "replay", kind: "replay", title: "Rejouer une erreur personnelle", minutes: 4, completed: false },
        { id: "review", kind: "review", title: "Révision espacée", minutes: 4, completed: false },
        { id: "exercise", kind: "exercise", title: "Plans de milieu de jeu", minutes: 5, completed: false },
        { id: "mini-game", kind: "mini-game", title: "Mini-partie sous pression", minutes: 5, completed: false },
        { id: "summary", kind: "summary", title: "Bilan et prochain rappel", minutes: 2, completed: false },
      ],
    };
  }
}

const messages: Record<SkillArea, string> = {
  openings: "L’ouverture est saine. Vérifie surtout le plan de pièces avant de mémoriser une nouvelle variante.",
  tactics: "Avant de jouer, balaie échecs, prises et menaces — pour toi comme pour l’adversaire.",
  strategy: "Ne cherche pas encore un coup. Nomme d’abord ta pire pièce et le pion faible que tu peux cibler.",
  endgames: "Ta technique de finale est un point fort : simplifie seulement si l’activité de ton roi reste supérieure.",
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

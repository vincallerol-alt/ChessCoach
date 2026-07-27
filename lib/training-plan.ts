import type { Exercise, SkillArea, TrainingPlan } from "./types";

export function distinctExercises(exercises: Exercise[]) {
  const seen = new Set<string>();
  return exercises.filter((exercise) => {
    const key = exercise.fen.split(" ").slice(0, 4).join(" ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function preparePlan(plan: TrainingPlan, exercises: Exercise[]): TrainingPlan {
  if (plan.sessionKind === "match") {
    return {
      ...plan,
      contentVersion: 2,
      steps: plan.steps.map((step) => ({ ...step, completed: plan.contentVersion === 2 ? step.completed : false })),
    };
  }
  if (plan.contentVersion === 2 && plan.steps.some((step) => (step.exerciseIds?.length ?? 0) > 0)) return plan;
  const library = distinctExercises(exercises);
  const seed = [...plan.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const rotated = library.length
    ? library.map((_, index) => library[(seed + index) % library.length])
    : [];
  const replay = rotated[0];
  const review = rotated[1] ?? replay;
  const series = rotated.slice(2);
  const ids = (items: Exercise[]) => items.map((exercise) => exercise.id);
  const replayStep = { id: "replay", kind: "replay" as const, title: "Rejouer une erreur personnelle", minutes: 4, completed: false, exerciseIds: replay ? [replay.id] : [] };
  const reviewStep = { id: "review", kind: "review" as const, title: "Révision espacée · 1 position", minutes: 3, completed: false, exerciseIds: review ? [review.id] : [] };
  const summaryStep = { id: "summary", kind: "summary" as const, title: "Bilan et prochaine intention", minutes: 2, completed: false };
  const miniGame = (minutes: number, title: string) => ({ id: "mini-game", kind: "mini-game" as const, title, minutes, completed: false, startFen: replay?.fen });

  const stepsByFocus: Record<SkillArea, TrainingPlan["steps"]> = {
    tactics: [
      replayStep,
      reviewStep,
      { id: "exercise", kind: "exercise", title: `Sprint tactique · ${Math.min(4, Math.max(1, series.length))} positions`, minutes: 6, completed: false, exerciseIds: ids(series.slice(0, 4)) },
      miniGame(5, "Conversion depuis la position critique"),
      summaryStep,
    ],
    strategy: [
      { ...replayStep, minutes: 5, title: "Diagnostiquer une décision de milieu de jeu" },
      { id: "exercise", kind: "exercise", title: `Comparer les plans · ${Math.min(3, Math.max(1, series.length))} positions`, minutes: 7, completed: false, exerciseIds: ids(series.slice(0, 3)) },
      miniGame(6, "Mini-partie avec objectif positionnel"),
      summaryStep,
    ],
    time: [
      replayStep,
      reviewStep,
      { id: "exercise", kind: "exercise", title: `Décision rapide · ${Math.min(3, Math.max(1, series.length))} positions`, minutes: 5, completed: false, exerciseIds: ids(series.slice(0, 3)) },
      miniGame(6, "Mini-partie sous contrainte de temps"),
      summaryStep,
    ],
    openings: [
      { ...reviewStep, minutes: 4, title: "Retrouver le plan après l’ouverture" },
      { id: "exercise", kind: "exercise", title: `Sortie d’ouverture · ${Math.min(3, Math.max(1, series.length))} positions`, minutes: 6, completed: false, exerciseIds: ids(series.slice(0, 3)) },
      miniGame(8, "Partie depuis la fin de l’ouverture"),
      summaryStep,
    ],
    endgames: [
      { ...replayStep, minutes: 5, title: "Rejouer une conversion manquée" },
      { id: "exercise", kind: "exercise", title: `Technique de finale · ${Math.min(3, Math.max(1, series.length))} positions`, minutes: 7, completed: false, exerciseIds: ids(series.slice(0, 3)) },
      miniGame(6, "Finale pratique contre le coach"),
      summaryStep,
    ],
  };
  return {
    ...plan,
    contentVersion: 2,
    steps: stepsByFocus[plan.focus],
  };
}

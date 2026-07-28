import { AdaptiveCoachPlanner, weaknessPriority } from "./coach";
import { preparePlan } from "./training-plan";
import type { Attempt, Exercise, Game, PlayerProfile, SkillArea, TrainingPlan, TrainingProgram, WeaknessSignal } from "./types";

export const DEFAULT_TARGET_RATING = 1500;
export const DEFAULT_DAILY_MINUTES = 20;
export const PROGRAM_DURATION_DAYS = 14;

const areas: SkillArea[] = ["tactics", "strategy", "time", "openings", "endgames"];
const labels: Record<SkillArea, string> = {
  openings: "Plans à la sortie de l’ouverture",
  tactics: "Vérification tactique avant de jouer",
  strategy: "Construire un plan en milieu de jeu",
  endgames: "Technique et conversion en finale",
  time: "Décider sous pression",
};

export function createEmptyProfile(): PlayerProfile {
  return {
    id: "current-player",
    chessComUsername: "",
    displayName: "Joueur",
    blitzRating: 0,
    blitzPeak: 0,
    targetRating: DEFAULT_TARGET_RATING,
    dailyMinutes: DEFAULT_DAILY_MINUTES,
    skillRatings: { openings: 0, tactics: 0, strategy: 0, endgames: 0, time: 0 },
    strengths: [],
    focusAreas: [],
  };
}

export function deriveRatingFromGames(games: Game[], username: string) {
  const blitzGames = games
    .filter((game) => game.timeClass === "blitz")
    .sort((left, right) => right.playedAt.localeCompare(left.playedAt));
  const ratings = blitzGames
    .map((game) => game.playerColor === "white" ? game.whiteRating : game.blackRating)
    .filter((rating): rating is number => typeof rating === "number" && rating > 0);
  const latest = blitzGames.find((game) => {
    if (!username) return true;
    const player = game.playerColor === "white" ? game.white : game.black;
    return player.toLowerCase() === username.toLowerCase();
  });
  const latestRating = latest
    ? latest.playerColor === "white" ? latest.whiteRating : latest.blackRating
    : ratings[0];
  return {
    blitzRating: latestRating ?? ratings[0] ?? 0,
    blitzPeak: ratings.length ? Math.max(...ratings) : 0,
  };
}

export function deriveWeaknessSignals(games: Game[], attempts: Attempt[], exercises: Exercise[]): WeaknessSignal[] {
  const positions = games.flatMap((game) =>
    (game.criticalPositions ?? []).map((position) => ({ ...position, playedAt: game.playedAt })),
  );
  const exerciseAreas = new Map(exercises.map((exercise) => [exercise.id, exercise.area]));
  const totalPositions = Math.max(1, positions.length);
  const now = Date.now();

  return areas.flatMap((area) => {
    const areaPositions = positions.filter((position) => position.area === area);
    const areaAttempts = attempts.filter((attempt) => exerciseAreas.get(attempt.exerciseId) === area);
    if (!areaPositions.length && !areaAttempts.length) return [];

    const latestPositionAt = areaPositions.reduce(
      (latest, position) => Math.max(latest, Date.parse(position.playedAt) || 0),
      0,
    );
    const ageDays = latestPositionAt ? Math.max(0, (now - latestPositionAt) / 86_400_000) : 30;
    const raw = {
      id: `runtime-${area}`,
      area,
      label: labels[area],
      recurrence: Math.min(1, areaPositions.length / totalPositions * 2),
      evaluationLoss: areaPositions.length
        ? Math.min(1, areaPositions.reduce((sum, position) => sum + position.centipawnLoss, 0) / areaPositions.length / 300)
        : 0,
      recency: areaPositions.length ? Math.max(0, 1 - ageDays / 30) : 0,
      timePressure: area === "time" ? Math.min(1, areaPositions.length / Math.max(1, games.length / 5)) : 0,
      failedAttempts: areaAttempts.length
        ? areaAttempts.filter((attempt) => !attempt.correct).length / areaAttempts.length
        : 0,
    };
    return [{ ...raw, priority: weaknessPriority(raw) }];
  }).sort((left, right) => right.priority - left.priority);
}

export function deriveProfile(profile: PlayerProfile, games: Game[], signals: WeaknessSignal[]): PlayerProfile {
  const rating = deriveRatingFromGames(games, profile.chessComUsername);
  const blitzRating = profile.blitzRating || rating.blitzRating;
  const baseline = blitzRating || 0;
  const priorityByArea = new Map(signals.map((signal) => [signal.area, signal.priority]));
  const skillRatings = Object.fromEntries(areas.map((area) => [
    area,
    baseline ? Math.max(400, Math.round(baseline - (priorityByArea.get(area) ?? 0) * 220)) : 0,
  ])) as Record<SkillArea, number>;
  const ranked = [...signals].sort((left, right) => right.priority - left.priority);

  return {
    ...profile,
    id: profile.chessComUsername || profile.id,
    blitzRating,
    blitzPeak: Math.max(profile.blitzPeak, rating.blitzPeak, blitzRating),
    skillRatings,
    strengths: ranked.length > 1 ? [labels[ranked[ranked.length - 1].area]] : [],
    focusAreas: ranked.slice(0, 2).map((signal) => signal.label),
  };
}

function dateAt(start: Date, offset: number) {
  const date = new Date(start);
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

function matchPlan(profile: PlayerProfile, date: Date, focus: SkillArea): TrainingPlan {
  const iso = date.toISOString().slice(0, 10);
  return {
    id: `${profile.id}-${iso}`,
    date: iso,
    durationMinutes: profile.dailyMinutes,
    contentVersion: 2,
    sessionKind: "match",
    focus,
    headline: "Partie réelle avec une mission précise",
    rationale: "Cette séance crée de nouvelles données pour mesurer votre progression et adapter la suite.",
    playMission: `Pendant la partie, concentrez-vous sur : ${labels[focus].toLowerCase()}.`,
    steps: [
      { id: "review", kind: "review", title: "Préparer la mission de jeu", minutes: 2, completed: false },
      { id: "mini-game", kind: "mini-game", title: "Jouer une partie sur Chess.com", minutes: Math.max(15, profile.dailyMinutes - 5), completed: false },
      { id: "summary", kind: "summary", title: "Noter la décision clé", minutes: 3, completed: false },
    ],
  };
}

export function buildTrainingProgram(
  profile: PlayerProfile,
  signals: WeaknessSignal[],
  exercises: Exercise[],
  sourceGameCount: number,
  start = new Date(),
  savedPlans: TrainingPlan[] = [],
): TrainingProgram {
  const planner = new AdaptiveCoachPlanner();
  const startDate = new Date(`${start.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const savedByDate = new Map(savedPlans.map((plan) => [plan.date, plan]));
  const focusRotation = signals.length ? signals.map((signal) => signal.area) : areas;
  const matchDays = new Set([2, 5, 9, 12]);
  const sessions = Array.from({ length: PROGRAM_DURATION_DAYS }, (_, index) => {
    const date = dateAt(startDate, index);
    const iso = date.toISOString().slice(0, 10);
    const saved = savedByDate.get(iso);
    if (saved) return preparePlan(saved, exercises);
    const focus = focusRotation[index % focusRotation.length];
    if (matchDays.has(index)) return matchPlan(profile, date, focus);
    return preparePlan({ ...planner.buildDailyPlan(profile, signals, date), focus }, exercises);
  });

  return {
    id: `${profile.id}-${startDate.toISOString().slice(0, 10)}-14d`,
    startDate: sessions[0].date,
    endDate: sessions[sessions.length - 1].date,
    sourceGameCount,
    sessions,
  };
}

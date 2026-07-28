import { describe, expect, it } from "vitest";
import { AdaptiveCoachPlanner, nextReviewDate, weaknessPriority } from "../lib/coach";
import { createLocalId } from "../lib/ids";
import { buildTrainingProgram, deriveRatingFromGames, deriveWeaknessSignals } from "../lib/runtime-coach";
import { preparePlan } from "../lib/training-plan";
import type { Exercise, Game, PlayerProfile, TrainingPlan, WeaknessSignal } from "../lib/types";

const profile: PlayerProfile = {
  id: "vincentito", chessComUsername: "vincentito", displayName: "Vincent", blitzRating: 1373, blitzPeak: 1501,
  targetRating: 1500, dailyMinutes: 20,
  skillRatings: { openings: 1300, tactics: 1350, strategy: 1250, endgames: 1400, time: 1280 },
  strengths: ["Finales"], focusAreas: ["Stratégie"],
};
const signal: WeaknessSignal = {
  id: "actual-strategy", area: "strategy", label: "Plans", recurrence: 1, evaluationLoss: .5,
  recency: 1, timePressure: 0, failedAttempts: 0, priority: .675,
};
const exercises: Exercise[] = Array.from({ length: 6 }, (_, index) => ({
  id: `exercise-${index}`,
  title: `Position ${index}`,
  area: index % 2 ? "strategy" : "tactics",
  fen: `8/8/8/8/8/8/${index + 1}K6/7k w - - 0 1`,
  sideToMove: "white",
  expectedMoves: ["b2b3"],
  explanation: "Fixture calculée pour le test.",
  source: "personal",
  dueAt: "2026-07-27T00:00:00.000Z",
  intervalDays: 1,
}));

describe("coach adaptatif", () => {
  it("applique les poids produit approuvés", () => {
    expect(weaknessPriority({ id: "x", area: "strategy", label: "x", recurrence: 1, evaluationLoss: 1, recency: 1, timePressure: 1, failedAttempts: 1 })).toBe(1);
    expect(weaknessPriority({ id: "x", area: "strategy", label: "x", recurrence: 1, evaluationLoss: 0, recency: 0, timePressure: 0, failedAttempts: 0 })).toBe(.35);
  });

  it("construit une séance de 20 minutes centrée sur la priorité", () => {
    const plan = new AdaptiveCoachPlanner().buildDailyPlan(profile, [signal], new Date("2026-07-27T12:00:00Z"));
    expect(plan.durationMinutes).toBe(20);
    expect(plan.steps.reduce((sum, step) => sum + step.minutes, 0)).toBe(20);
    expect(plan.focus).toBe("strategy");
    expect(plan.steps.every((step) => step.completed === false)).toBe(true);
  });

  it("avance ou réinitialise la répétition espacée", () => {
    const date = new Date("2026-07-27T00:00:00Z");
    expect(nextReviewDate(date, 3, true).toISOString().slice(0, 10)).toBe("2026-08-02");
    expect(nextReviewDate(date, 14, false).toISOString().slice(0, 10)).toBe("2026-07-28");
  });

  it("crée un identifiant compatible sans dépendre de randomUUID", () => {
    const first = createLocalId("attempt");
    const second = createLocalId("attempt");
    expect(first).toMatch(/^attempt-/);
    expect(second).not.toBe(first);
  });

  it("attribue des positions distinctes et démarre la mini-partie sur la position personnelle", () => {
    const legacyPlan: TrainingPlan = {
      id: "vincentito-2026-07-27",
      date: "2026-07-27",
      durationMinutes: 20,
      focus: "tactics",
      headline: "Tactique",
      rationale: "Test",
      steps: [
        { id: "replay", kind: "replay", title: "Replay", minutes: 4, completed: true },
        { id: "review", kind: "review", title: "Review", minutes: 4, completed: true },
        { id: "exercise", kind: "exercise", title: "Exercise", minutes: 5, completed: true },
        { id: "mini-game", kind: "mini-game", title: "Mini", minutes: 5, completed: false },
        { id: "summary", kind: "summary", title: "Bilan", minutes: 2, completed: false },
      ],
    };
    const prepared = preparePlan(legacyPlan, exercises);
    const replay = prepared.steps.find((step) => step.kind === "replay");
    const review = prepared.steps.find((step) => step.kind === "review");
    const series = prepared.steps.find((step) => step.kind === "exercise");
    const miniGame = prepared.steps.find((step) => step.kind === "mini-game");

    expect(replay?.exerciseIds?.[0]).not.toBe(review?.exerciseIds?.[0]);
    expect(series?.exerciseIds?.length).toBeGreaterThan(1);
    expect(series?.exerciseIds).not.toContain(replay?.exerciseIds?.[0]);
    expect(miniGame?.startFen).toBe(exercises.find((exercise) => exercise.id === replay?.exerciseIds?.[0])?.fen);
    expect(prepared.steps.every((step) => !step.completed)).toBe(true);
  });

  it("crée des formats de séance différents selon la compétence", () => {
    const base = new AdaptiveCoachPlanner().buildDailyPlan(profile, [signal], new Date("2026-07-27T12:00:00Z"));
    const tactics = preparePlan({ ...base, contentVersion: undefined, focus: "tactics" }, exercises);
    const strategy = preparePlan({ ...base, id: `${base.id}-strategy`, contentVersion: undefined, focus: "strategy" }, exercises);

    expect(tactics.steps.map((step) => step.title)).not.toEqual(strategy.steps.map((step) => step.title));
    expect(tactics.steps.length).not.toBe(strategy.steps.length);
    expect(tactics.steps.reduce((sum, step) => sum + step.minutes, 0)).toBe(20);
    expect(strategy.steps.reduce((sum, step) => sum + step.minutes, 0)).toBe(20);
  });

  it("calcule l’Elo et les faiblesses depuis les parties réelles", () => {
    const games: Game[] = [{
      id: "g1", source: "chess.com", sourceId: "g1", playedAt: new Date().toISOString(), timeClass: "blitz",
      playerColor: "white", result: "loss", white: "player", black: "opponent", whiteRating: 1422,
      pgn: "", analyzed: true,
      criticalPositions: [{ fen: "8/8/8/8/8/8/1K6/7k w - - 0 1", ply: 20, playedMove: "b2b3", bestMove: "b2c3", centipawnLoss: 180, area: "strategy" }],
    }];
    expect(deriveRatingFromGames(games, "player").blitzRating).toBe(1422);
    expect(deriveWeaknessSignals(games, [], []).map((item) => item.area)).toEqual(["strategy"]);
  });

  it("génère 14 jours depuis les données fournies, sans snapshot", () => {
    const program = buildTrainingProgram(profile, [signal], exercises, 1, new Date("2026-07-27T12:00:00Z"));
    expect(program.sessions).toHaveLength(14);
    expect(program.sourceGameCount).toBe(1);
    expect(program.sessions.filter((session) => session.sessionKind === "match")).toHaveLength(4);
  });
});

import { describe, expect, it } from "vitest";
import { AdaptiveCoachPlanner, defaultSignals, nextReviewDate, weaknessPriority } from "../lib/coach";
import { createLocalId } from "../lib/ids";
import { preparePlan } from "../lib/training-plan";
import type { Exercise, PlayerProfile, TrainingPlan } from "../lib/types";
import coachSnapshot from "../data/coach-snapshot.json";

const profile: PlayerProfile = {
  id: "vincentito", chessComUsername: "vincentito", displayName: "Vincent", blitzRating: 1373, blitzPeak: 1501,
  targetRating: 1500, dailyMinutes: 20,
  skillRatings: { openings: 1300, tactics: 1350, strategy: 1250, endgames: 1400, time: 1280 },
  strengths: ["Finales"], focusAreas: ["Stratégie"],
};

describe("coach adaptatif", () => {
  it("applique les poids produit approuvés", () => {
    expect(weaknessPriority({ id: "x", area: "strategy", label: "x", recurrence: 1, evaluationLoss: 1, recency: 1, timePressure: 1, failedAttempts: 1 })).toBe(1);
    expect(weaknessPriority({ id: "x", area: "strategy", label: "x", recurrence: 1, evaluationLoss: 0, recency: 0, timePressure: 0, failedAttempts: 0 })).toBe(.35);
  });

  it("construit une séance de 20 minutes centrée sur la priorité", () => {
    const plan = new AdaptiveCoachPlanner().buildDailyPlan(profile, defaultSignals, new Date("2026-07-27T12:00:00Z"));
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
    const exercises = coachSnapshot.exercises as Exercise[];
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
    const exercises = coachSnapshot.exercises as Exercise[];
    const base = new AdaptiveCoachPlanner().buildDailyPlan(profile, defaultSignals, new Date("2026-07-27T12:00:00Z"));
    const tactics = preparePlan({ ...base, contentVersion: undefined, focus: "tactics" }, exercises);
    const strategy = preparePlan({ ...base, id: `${base.id}-strategy`, contentVersion: undefined, focus: "strategy" }, exercises);

    expect(tactics.steps.map((step) => step.title)).not.toEqual(strategy.steps.map((step) => step.title));
    expect(tactics.steps.length).not.toBe(strategy.steps.length);
    expect(tactics.steps.reduce((sum, step) => sum + step.minutes, 0)).toBe(20);
    expect(strategy.steps.reduce((sum, step) => sum + step.minutes, 0)).toBe(20);
  });
});

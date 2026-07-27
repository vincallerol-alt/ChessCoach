import { describe, expect, it } from "vitest";
import { AdaptiveCoachPlanner, defaultSignals, nextReviewDate, weaknessPriority } from "../lib/coach";
import { createLocalId } from "../lib/ids";
import type { PlayerProfile } from "../lib/types";

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
});

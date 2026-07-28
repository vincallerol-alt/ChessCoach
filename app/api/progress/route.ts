import { GET as getCloudState } from "../sync/route";
import type { CloudState } from "../../../lib/cloud-sync";
import { createEmptyProfile, deriveProfile, deriveWeaknessSignals } from "../../../lib/runtime-coach";

export async function GET() {
  const response = await getCloudState();
  if (!response.ok) return response;
  const state = await response.json() as CloudState;
  const signals = deriveWeaknessSignals(state.games, state.attempts, state.exercises);
  const profile = deriveProfile({ ...createEmptyProfile(), ...(state.profile ?? {}) }, state.games, signals);
  const firstAttempts = new Map<string, boolean>();
  [...state.attempts]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .forEach((attempt) => {
      if (!firstAttempts.has(attempt.exerciseId)) firstAttempts.set(attempt.exerciseId, attempt.correct);
    });

  return Response.json({
    currentRating: profile.blitzRating,
    peakRating: profile.blitzPeak,
    targetRating: profile.targetRating,
    importedGames: state.games.length,
    analyzedGames: state.games.filter((game) => game.analyzed).length,
    attempts: state.attempts.length,
    firstTryRate: firstAttempts.size
      ? [...firstAttempts.values()].filter(Boolean).length / firstAttempts.size
      : null,
    skillRatings: profile.skillRatings,
    weaknesses: signals,
    generatedAt: new Date().toISOString(),
  });
}

import {
  cacheAttempts,
  cacheExercises,
  cacheGames,
  listCachedExercises,
  listCachedGames,
  listTrainingPlans,
  saveTrainingPlan,
  syncPendingAttempts,
} from "./offline-db";
import type { Attempt, Exercise, Game, TrainingPlan } from "./types";

type CloudState = {
  games: Game[];
  plans: TrainingPlan[];
  exercises: Exercise[];
  attempts: Attempt[];
};

export async function syncCloudState(): Promise<CloudState> {
  await syncPendingAttempts();
  const [games, plans, exercises] = await Promise.all([
    listCachedGames(),
    listTrainingPlans(),
    listCachedExercises(),
  ]);

  const writeResponse = await fetch("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ games, plans, exercises }),
  });
  if (!writeResponse.ok) throw new Error("cloud-write");

  const readResponse = await fetch("/api/sync", { cache: "no-store" });
  if (!readResponse.ok) throw new Error("cloud-read");
  const state = await readResponse.json() as CloudState;

  await Promise.all([
    cacheGames(state.games),
    cacheExercises(state.exercises),
    cacheAttempts(state.attempts),
    ...state.plans.map((plan) => saveTrainingPlan(plan)),
  ]);
  return state;
}

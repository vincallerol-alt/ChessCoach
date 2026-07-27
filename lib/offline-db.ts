import Dexie, { type EntityTable } from "dexie";
import type { Attempt, Game, TrainingPlan } from "./types";

type Setting = { key: string; value: string };

class ChessCoachDatabase extends Dexie {
  games!: EntityTable<Game, "id">;
  attempts!: EntityTable<Attempt, "id">;
  plans!: EntityTable<TrainingPlan, "id">;
  settings!: EntityTable<Setting, "key">;

  constructor() {
    super("chesscoach");
    this.version(1).stores({
      games: "id, sourceId, playedAt, timeClass, result, analyzed",
      attempts: "id, exerciseId, createdAt, synced",
      plans: "id, date, focus",
      settings: "key",
    });
    this.version(2).stores({
      games: "id, sourceId, playedAt, timeClass, result, analyzed",
      attempts: "id, exerciseId, createdAt, synced",
      plans: "id, date, focus",
      settings: "key",
    }).upgrade((transaction) => transaction.table("plans").clear());
  }
}

export const offlineDb = new ChessCoachDatabase();

export async function queueAttempt(attempt: Attempt) {
  await offlineDb.attempts.put(attempt);
}

export async function cacheGames(games: Game[]) {
  await offlineDb.games.bulkPut(games);
}

export async function loadTrainingPlan(id: string) {
  return offlineDb.plans.get(id);
}

export async function saveTrainingPlan(plan: TrainingPlan) {
  await offlineDb.plans.put(plan);
}

export async function listTrainingPlans() {
  return offlineDb.plans.orderBy("date").reverse().toArray();
}

export async function unsyncedAttempts() {
  return offlineDb.attempts.where("synced").equals(0).toArray();
}
export async function syncPendingAttempts() {
  const pending = await unsyncedAttempts();
  for (const attempt of pending) {
    try {
      const response = await fetch("/api/exercises/attempt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(attempt),
      });
      if (response.ok) await offlineDb.attempts.update(attempt.id, { synced: true });
    } catch {
      break;
    }
  }
  return pending.length;
}

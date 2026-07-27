import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { attempts } from "../../../../db/schema";
import { nextReviewDate } from "../../../../lib/coach";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { id?: string; exerciseId?: string; move?: string; correct?: boolean; responseMs?: number; intervalDays?: number; createdAt?: string };
    if (!payload.exerciseId || !payload.move || typeof payload.correct !== "boolean") return Response.json({ error: "Tentative invalide" }, { status: 400 });
    const createdAt = payload.createdAt ? new Date(payload.createdAt) : new Date();
    const id = payload.id ?? crypto.randomUUID();
    const user = await getChatGPTUser();
    try {
      await getDb().insert(attempts).values({ id, ownerEmail: user?.email ?? "local@chesscoach.app", exerciseId: payload.exerciseId, move: payload.move, correct: payload.correct, responseMs: payload.responseMs ?? 0, createdAt: createdAt.toISOString() }).onConflictDoNothing();
    } catch {
      // The PWA queues the same payload in IndexedDB when D1 is unavailable.
    }
    return Response.json({ accepted: true, id, nextReviewAt: nextReviewDate(createdAt, payload.intervalDays ?? 1, payload.correct).toISOString() });
  } catch {
    return Response.json({ error: "Tentative illisible" }, { status: 400 });
  }
}
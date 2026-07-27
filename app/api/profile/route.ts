import { eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { profiles } from "../../../db/schema";

const fallback = { chessComUsername: "vincentito", displayName: "Vincent", targetRating: 1500, dailyMinutes: 20 };

export async function GET() {
  try {
    const user = await getChatGPTUser();
    const email = user?.email ?? "local@chesscoach.app";
    const [profile] = await getDb().select().from(profiles).where(eq(profiles.email, email)).limit(1);
    return Response.json({ profile: profile ?? { email, ...fallback } });
  } catch {
    return Response.json({ profile: { email: "local@chesscoach.app", ...fallback } });
  }
}

export async function PUT(request: Request) {
  const body = await request.json() as { chessComUsername?: string; targetRating?: number; dailyMinutes?: number };
  const user = await getChatGPTUser();
  const email = user?.email ?? "local@chesscoach.app";
  const now = new Date().toISOString();
  const values = {
    email,
    chessComUsername: body.chessComUsername?.trim() || fallback.chessComUsername,
    displayName: user?.displayName ?? fallback.displayName,
    targetRating: Math.min(2400, Math.max(600, body.targetRating ?? fallback.targetRating)),
    dailyMinutes: Math.min(60, Math.max(10, body.dailyMinutes ?? fallback.dailyMinutes)),
    createdAt: now,
    updatedAt: now,
  };
  try {
    await getDb().insert(profiles).values(values).onConflictDoUpdate({ target: profiles.email, set: { chessComUsername: values.chessComUsername, targetRating: values.targetRating, dailyMinutes: values.dailyMinutes, updatedAt: now } });
  } catch {
    return Response.json({ profile: values, persisted: false });
  }
  return Response.json({ profile: values, persisted: true });
}
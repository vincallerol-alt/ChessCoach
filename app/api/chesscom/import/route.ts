import { desc } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getDb } from "../../../../db";
import { games as gamesTable, profiles } from "../../../../db/schema";
import type { Game } from "../../../../lib/types";

type ChessComPlayer = { username: string; rating?: number; result: string };
type ChessComGame = {
  uuid?: string;
  url?: string;
  pgn: string;
  end_time: number;
  time_class: string;
  white: ChessComPlayer;
  black: ChessComPlayer;
};

const headers = { "user-agent": "ChessCoach/0.1 contact: local-private-beta", accept: "application/json" };
const drawResults = new Set(["agreed", "repetition", "stalemate", "insufficient", "50move", "timevsinsufficient"]);

function normalizeGame(raw: ChessComGame, username: string): Game | null {
  const playerIsWhite = raw.white.username.toLowerCase() === username.toLowerCase();
  const player = playerIsWhite ? raw.white : raw.black;
  if (!playerIsWhite && raw.black.username.toLowerCase() !== username.toLowerCase()) return null;
  const result: Game["result"] = player.result === "win" ? "win" : drawResults.has(player.result) ? "draw" : "loss";
  const sourceId = raw.uuid ?? raw.url ?? `${raw.end_time}-${raw.white.username}-${raw.black.username}`;
  const allowed = ["bullet", "blitz", "rapid", "daily"].includes(raw.time_class) ? raw.time_class as Game["timeClass"] : "other";
  return {
    id: `chesscom-${sourceId}`,
    source: "chess.com",
    sourceId,
    playedAt: new Date(raw.end_time * 1000).toISOString(),
    timeClass: allowed,
    playerColor: playerIsWhite ? "white" : "black",
    result,
    white: raw.white.username,
    black: raw.black.username,
    whiteRating: raw.white.rating,
    blackRating: raw.black.rating,
    pgn: raw.pgn,
    url: raw.url,
    analyzed: false,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string; limit?: number };
    const username = (body.username ?? "vincentito").trim().toLowerCase();
    const limit = Math.max(1, Math.min(300, body.limit ?? 300));
    if (!/^[a-z0-9_-]{2,40}$/i.test(username)) return Response.json({ error: "Nom Chess.com invalide" }, { status: 400 });

    const archiveResponse = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`, { headers });
    if (!archiveResponse.ok) return Response.json({ error: "Profil Chess.com inaccessible" }, { status: archiveResponse.status });
    const { archives } = await archiveResponse.json() as { archives: string[] };
    const imported: Game[] = [];

    for (const archive of archives.slice(-10).reverse()) {
      if (imported.length >= limit) break;
      const response = await fetch(archive, { headers });
      if (response.status === 429) break;
      if (!response.ok) continue;
      const payload = await response.json() as { games: ChessComGame[] };
      for (const raw of payload.games.slice().reverse()) {
        const game = normalizeGame(raw, username);
        if (game && (game.timeClass === "blitz" || game.timeClass === "rapid")) imported.push(game);
        if (imported.length >= limit) break;
      }
    }

    let persisted = 0;
    try {
      const user = await getChatGPTUser();
      const ownerEmail = user?.email ?? "local@chesscoach.app";
      const db = getDb();
      const now = new Date().toISOString();
      await db.insert(profiles).values({ email: ownerEmail, chessComUsername: username, displayName: user?.displayName ?? "Vincent", targetRating: 1500, dailyMinutes: 20, createdAt: now, updatedAt: now }).onConflictDoUpdate({ target: profiles.email, set: { chessComUsername: username, updatedAt: now } });
      for (const game of imported) {
        const rows = await db.insert(gamesTable).values({ ...game, ownerEmail, username, createdAt: now }).onConflictDoNothing().returning({ id: gamesTable.id });
        persisted += rows.length;
      }
    } catch {
      // Local preview keeps the authoritative offline copy in IndexedDB.
    }

    return Response.json({ games: imported, imported: imported.length, persisted, analyzedQueued: Math.min(300, imported.length) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Import impossible" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getChatGPTUser();
    const ownerEmail = user?.email ?? "local@chesscoach.app";
    const db = getDb();
    const rows = await db.select().from(gamesTable).orderBy(desc(gamesTable.playedAt)).limit(100);
    return Response.json({ games: rows.filter((game) => game.ownerEmail === ownerEmail) });
  } catch {
    return Response.json({ games: [] });
  }
}
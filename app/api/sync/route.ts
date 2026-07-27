import { desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { attempts, exercises, games, trainingPlans } from "../../../db/schema";
import type { Attempt, Exercise, Game, TrainingPlan } from "../../../lib/types";

const localOwner = "local@chesscoach.app";

async function ownerEmail() {
  return (await getChatGPTUser())?.email ?? localOwner;
}

export async function GET() {
  try {
    const owner = await ownerEmail();
    const db = getDb();
    const [gameRows, planRows, exerciseRows, attemptRows] = await Promise.all([
      db.select().from(games).where(eq(games.ownerEmail, owner)).orderBy(desc(games.playedAt)).limit(350),
      db.select().from(trainingPlans).where(eq(trainingPlans.ownerEmail, owner)).orderBy(desc(trainingPlans.date)).limit(30),
      db.select().from(exercises).where(eq(exercises.ownerEmail, owner)).orderBy(desc(exercises.dueAt)).limit(50),
      db.select().from(attempts).where(eq(attempts.ownerEmail, owner)).orderBy(desc(attempts.createdAt)).limit(500),
    ]);

    const syncedGames: Game[] = gameRows.map((row) => ({
      id: row.id,
      source: row.source as Game["source"],
      sourceId: row.sourceId,
      playedAt: row.playedAt,
      timeClass: row.timeClass as Game["timeClass"],
      playerColor: row.playerColor as Game["playerColor"],
      result: row.result as Game["result"],
      white: row.white,
      black: row.black,
      whiteRating: row.whiteRating ?? undefined,
      blackRating: row.blackRating ?? undefined,
      pgn: row.pgn,
      url: row.url ?? undefined,
      analyzed: row.analyzed,
      timeControl: row.timeControl ?? undefined,
      criticalPositions: (row.criticalPositions as Game["criticalPositions"]) ?? undefined,
    }));

    const syncedAttempts: Attempt[] = attemptRows.map((row) => ({
      id: row.id,
      exerciseId: row.exerciseId,
      move: row.move,
      correct: row.correct,
      responseMs: row.responseMs,
      createdAt: row.createdAt,
      synced: true,
    }));

    return Response.json({
      games: syncedGames,
      plans: planRows.map((row) => row.plan as TrainingPlan),
      exercises: exerciseRows.map((row) => ({
        id: row.id,
        title: row.title,
        area: row.area as Exercise["area"],
        fen: row.fen,
        sideToMove: row.fen.includes(" w ") ? "white" : "black",
        expectedMoves: row.expectedMoves as string[],
        explanation: row.explanation,
        source: row.source as Exercise["source"],
        sourceUrl: row.sourceUrl ?? undefined,
        dueAt: row.dueAt,
        intervalDays: row.intervalDays,
        centipawnLoss: row.centipawnLoss ?? undefined,
        originGameId: row.originGameId ?? undefined,
        comparisonMove: row.comparisonMove ?? undefined,
      } satisfies Exercise)),
      attempts: syncedAttempts,
    });
  } catch {
    return Response.json({ error: "Synchronisation cloud indisponible" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const owner = await ownerEmail();
    const payload = await request.json() as {
      games?: Game[];
      plans?: TrainingPlan[];
      exercises?: Exercise[];
    };
    const gameItems = (payload.games ?? []).slice(0, 350);
    const planItems = (payload.plans ?? []).slice(0, 30);
    const exerciseItems = (payload.exercises ?? []).slice(0, 50);
    const db = getDb();
    const now = new Date().toISOString();

    for (const game of gameItems) {
      await db.insert(games).values({
        id: game.id,
        ownerEmail: owner,
        sourceId: game.sourceId,
        source: game.source,
        username: game.source === "chesscoach" ? "chesscoach" : "vincentito",
        playedAt: game.playedAt,
        timeClass: game.timeClass,
        playerColor: game.playerColor,
        result: game.result,
        white: game.white,
        black: game.black,
        whiteRating: game.whiteRating,
        blackRating: game.blackRating,
        pgn: game.pgn,
        url: game.url,
        timeControl: game.timeControl,
        criticalPositions: game.criticalPositions,
        analyzed: game.analyzed,
        createdAt: now,
      }).onConflictDoUpdate({
        target: games.id,
        set: {
          analyzed: game.analyzed,
          criticalPositions: game.criticalPositions,
          timeControl: game.timeControl,
        },
      });
    }

    for (const plan of planItems) {
      await db.insert(trainingPlans).values({
        id: plan.id,
        ownerEmail: owner,
        date: plan.date,
        focus: plan.focus,
        plan,
        createdAt: now,
      }).onConflictDoUpdate({
        target: trainingPlans.id,
        set: { focus: plan.focus, plan },
      });
    }

    for (const exercise of exerciseItems) {
      await db.insert(exercises).values({
        id: exercise.id,
        ownerEmail: owner,
        title: exercise.title,
        area: exercise.area,
        fen: exercise.fen,
        expectedMoves: exercise.expectedMoves,
        explanation: exercise.explanation,
        source: exercise.source,
        sourceUrl: exercise.sourceUrl,
        dueAt: exercise.dueAt,
        intervalDays: exercise.intervalDays,
        centipawnLoss: exercise.centipawnLoss,
        originGameId: exercise.originGameId,
        comparisonMove: exercise.comparisonMove,
      }).onConflictDoUpdate({
        target: exercises.id,
        set: {
          dueAt: exercise.dueAt,
          intervalDays: exercise.intervalDays,
          centipawnLoss: exercise.centipawnLoss,
        },
      });
    }

    return Response.json({
      synced: {
        games: gameItems.length,
        plans: planItems.length,
        exercises: exerciseItems.length,
      },
    });
  } catch {
    return Response.json({ error: "Écriture cloud impossible" }, { status: 503 });
  }
}

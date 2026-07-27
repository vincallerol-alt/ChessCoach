import { askChessCoach, type CoachAgentContext } from "../../../lib/coach-agent";

const clean = (value: unknown, limit: number) =>
  typeof value === "string" ? value.trim().slice(0, limit) : undefined;

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<CoachAgentContext>;
    const question = clean(body.question, 600);
    if (!question) return Response.json({ error: "Question manquante" }, { status: 400 });

    const context: CoachAgentContext = {
      question,
      fen: clean(body.fen, 120),
      stepTitle: clean(body.stepTitle, 120),
      playedMove: clean(body.playedMove, 12),
      bestMove: clean(body.bestMove, 12),
      evaluationLoss: typeof body.evaluationLoss === "number"
        ? Math.max(0, Math.min(5_000, Math.round(body.evaluationLoss)))
        : undefined,
      explanation: clean(body.explanation, 500),
    };

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({
        answer: "Le coach IA n’est pas encore activé sur cet environnement. L’analyse Stockfish et les conseils déterministes restent disponibles.",
        source: "deterministic",
      });
    }

    const answer = await askChessCoach(context);
    return Response.json({ answer, source: "openai" });
  } catch {
    return Response.json({ error: "Le coach IA est momentanément indisponible." }, { status: 503 });
  }
}

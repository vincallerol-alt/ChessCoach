import { Agent, run } from "@openai/agents";

export type CoachAgentContext = {
  fen?: string;
  stepTitle?: string;
  question: string;
  playedMove?: string;
  bestMove?: string;
  evaluationLoss?: number;
  explanation?: string;
};

const chessCoach = new Agent({
  name: "ChessCoach",
  model: "gpt-5-mini",
  instructions: `Tu es un entraîneur d'échecs personnel francophone. L'objectif Elo et le contexte du joueur sont fournis dynamiquement par l'application.
Réponds en 2 à 5 phrases courtes, concrètes et pédagogiques.
Stockfish reste la source de vérité tactique : n'invente jamais une variante forcée ni un coup légal absent du contexte.
Explique dans cet ordre : menace immédiate, raison positionnelle, règle réutilisable.
Pose au maximum une question socratique. Ne révèle le meilleur coup que s'il est fourni ou explicitement demandé.
Quand une FEN est fournie, utilise-la comme position de référence. Signale clairement si les données sont insuffisantes.`,
});

export async function askChessCoach(context: CoachAgentContext) {
  const prompt = [
    `Question du joueur : ${context.question}`,
    context.stepTitle ? `Étape : ${context.stepTitle}` : "",
    context.fen ? `FEN : ${context.fen}` : "",
    context.playedMove ? `Coup joué : ${context.playedMove}` : "",
    context.bestMove ? `Meilleur coup Stockfish : ${context.bestMove}` : "",
    typeof context.evaluationLoss === "number" ? `Perte : ${context.evaluationLoss} centipions` : "",
    context.explanation ? `Contexte déterministe : ${context.explanation}` : "",
  ].filter(Boolean).join("\n");

  const result = await run(chessCoach, prompt, { maxTurns: 2 });
  return String(result.finalOutput ?? "").trim();
}

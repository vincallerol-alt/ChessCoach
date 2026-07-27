import Fastify from "fastify";
import { NativeStockfishEngine } from "./engine";

const app = Fastify({ logger: true });
const engine = new NativeStockfishEngine();

app.get("/health", async () => ({ status: "ok", engine: "Stockfish 18", multiPv: 3 }));
app.post<{ Body: { fen?: string; fens?: string[]; depth?: number } }>("/analyze", async (request, reply) => {
  const { fen, fens, depth } = request.body ?? {};
  try {
    if (fens?.length) return { analyses: await engine.analyzeBatch(fens.slice(0, 160)) };
    if (!fen) return reply.code(400).send({ error: "fen ou fens requis" });
    return { analysis: await engine.analyze(fen, Math.min(24, Math.max(8, depth ?? 16)), 3) };
  } catch (error) {
    request.log.error(error);
    return reply.code(503).send({ error: "Moteur Stockfish indisponible", hint: "Configurer STOCKFISH_PATH avec le binaire Stockfish 18." });
  }
});

const port = Number(process.env.PORT ?? 8788);
app.listen({ port, host: "0.0.0.0" }).catch((error) => { app.log.error(error); process.exit(1); });
process.on("SIGTERM", () => { engine.stop(); app.close(); });
export async function GET() {
  return Response.json({
    engine: "Stockfish 18",
    strategy: "quick-all-then-deep-critical",
    multiPv: 3,
    queued: 0,
    running: 0,
    completed: 0,
    workerConfigured: Boolean(process.env.ENGINE_API_URL),
  });
}
export async function GET() {
  return Response.json({
    engine: "Stockfish 18 Lite",
    runtime: "device-wasm",
    strategy: "quick-local-then-critical-local",
    multiPv: 3,
    serverRequired: false,
    offlineCapable: true,
  });
}

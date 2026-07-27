import type { EngineAdapter, PositionAnalysis } from "./types";

export class StockfishLiteAdapter implements EngineAdapter {
  private worker: Worker | null = null;
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private resolveMove: ((move: string) => void) | null = null;
  private infoLines: string[] = [];

  ready(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      try {
        this.worker = new Worker("/engine/stockfish-18-lite-single.js");
        this.worker.onmessage = (event) => this.onMessage(String(event.data));
        this.worker.onerror = () => reject(new Error("Stockfish Lite indisponible"));
        this.send("uci");
        this.send("isready");
      } catch (error) {
        reject(error);
      }
    });
    return this.readyPromise;
  }

  async bestMove(fen: string, skillLevel: number, moveTimeMs = 450): Promise<string> {
    await this.ready();
    this.send("stop");
    this.send(`setoption name Skill Level value ${Math.max(0, Math.min(20, skillLevel))}`);
    this.send(`position fen ${fen}`);
    return new Promise((resolve) => {
      this.resolveMove = resolve;
      this.send(`go movetime ${moveTimeMs}`);
    });
  }

  async analyze(fen: string, depth = 12, multiPv = 3): Promise<PositionAnalysis> {
    await this.ready();
    this.infoLines = [];
    this.send(`setoption name MultiPV value ${multiPv}`);
    this.send(`position fen ${fen}`);
    const move = await new Promise<string>((resolve) => {
      this.resolveMove = resolve;
      this.send(`go depth ${depth}`);
    });
    const latest = this.infoLines.at(-1) ?? "";
    const cp = Number(latest.match(/score cp (-?\d+)/)?.[1] ?? 0);
    return {
      fen,
      ply: 0,
      evaluationCp: cp,
      bestMove: move,
      multipv: [],
      depth,
    };
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.readyPromise = null;
  }

  private send(command: string) {
    this.worker?.postMessage(command);
  }

  private onMessage(message: string) {
    if (message === "readyok") this.resolveReady?.();
    if (message.startsWith("info ")) this.infoLines.push(message);
    if (message.startsWith("bestmove ")) {
      const move = message.split(" ")[1];
      this.resolveMove?.(move);
      this.resolveMove = null;
    }
  }
}
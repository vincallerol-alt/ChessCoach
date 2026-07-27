import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import type { PositionAnalysis } from "../lib/types";

type Waiter = { predicate: (line: string) => boolean; resolve: (lines: string[]) => void; lines: string[] };

export class NativeStockfishEngine {
  private process: ChildProcessWithoutNullStreams | null = null;
  private waiters: Waiter[] = [];

  async start() {
    if (this.process) return;
    const binary = process.env.STOCKFISH_PATH ?? "stockfish";
    this.process = spawn(binary, [], { stdio: "pipe" });
    const lines = createInterface({ input: this.process.stdout });
    lines.on("line", (line) => this.handleLine(line));
    this.process.on("exit", () => { this.process = null; });
    this.send("uci");
    await this.waitFor((line) => line === "uciok");
    this.send("setoption name Threads value 2");
    this.send("setoption name Hash value 256");
    this.send("isready");
    await this.waitFor((line) => line === "readyok");
  }

  async analyze(fen: string, depth = 14, multiPv = 3): Promise<PositionAnalysis> {
    await this.start();
    this.send(`setoption name MultiPV value ${multiPv}`);
    this.send(`position fen ${fen}`);
    this.send(`go depth ${depth}`);
    const lines = await this.waitFor((line) => line.startsWith("bestmove "));
    const best = lines.at(-1)?.split(" ")[1] ?? "";
    const infos = lines.filter((line) => line.startsWith("info ") && line.includes(" pv "));
    const byPv = new Map<number, string>();
    for (const line of infos) byPv.set(Number(line.match(/multipv (\d+)/)?.[1] ?? 1), line);
    const multipv = [...byPv.entries()].sort(([a], [b]) => a - b).map(([, line]) => ({
      move: line.split(" pv ")[1]?.split(" ")[0] ?? "",
      evaluationCp: Number(line.match(/score cp (-?\d+)/)?.[1] ?? (line.includes("score mate") ? 100000 : 0)),
      line: line.split(" pv ")[1]?.split(" ") ?? [],
    }));
    return { fen, ply: 0, evaluationCp: multipv[0]?.evaluationCp ?? 0, bestMove: best, multipv, depth };
  }

  async analyzeBatch(fens: string[]) {
    const quick: PositionAnalysis[] = [];
    for (const fen of fens) quick.push(await this.analyze(fen, 10, 1));
    const critical = quick.map((analysis, index) => ({ analysis, index })).filter(({ analysis, index }) => index > 0 && Math.abs(analysis.evaluationCp - quick[index - 1].evaluationCp) >= 100).slice(0, 12);
    const deep = new Map<number, PositionAnalysis>();
    for (const item of critical) deep.set(item.index, await this.analyze(item.analysis.fen, 18, 3));
    return quick.map((analysis, index) => deep.get(index) ?? analysis);
  }

  stop() { this.process?.kill(); this.process = null; }

  private send(command: string) { this.process?.stdin.write(`${command}\n`); }
  private waitFor(predicate: (line: string) => boolean) { return new Promise<string[]>((resolve) => this.waiters.push({ predicate, resolve, lines: [] })); }
  private handleLine(line: string) {
    for (const waiter of [...this.waiters]) {
      waiter.lines.push(line);
      if (waiter.predicate(line)) {
        this.waiters = this.waiters.filter((candidate) => candidate !== waiter);
        waiter.resolve(waiter.lines);
      }
    }
  }
}
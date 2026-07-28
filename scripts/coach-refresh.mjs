import { spawn } from "node:child_process";
import { copyFile, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Chess } from "chess.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXPORT_PATH = join(ROOT, "reports", "coach-latest.json");
const REPORT_PATH = join(ROOT, "reports", "coach-latest.md");
const USERNAME = (process.env.CHESSCOACH_USERNAME ?? "").trim().toLowerCase();
const MAX_GAMES = Math.max(1, Math.min(50, Number(process.env.CHESSCOACH_MAX_GAMES ?? 50)));
const LOOKBACK_DAYS = Math.max(14, Math.min(180, Number(process.env.CHESSCOACH_LOOKBACK_DAYS ?? 90)));
const NODES_PER_POSITION = Math.max(2_000, Math.min(40_000, Number(process.env.CHESSCOACH_NODES ?? 8_000)));
const DRY_RUN = process.argv.includes("--dry-run");
const HEADERS = {
  accept: "application/json",
  "user-agent": "ChessCoach/0.2 personal-maintenance",
};

const AREA_LABELS = {
  openings: "Stabiliser la sortie d’ouverture",
  tactics: "Vérification tactique avant de jouer",
  strategy: "Construire un plan en milieu de jeu",
  endgames: "Convertir les finales techniques",
  time: "Décider sous pression",
};

const clamp = (value) => Math.min(1, Math.max(0, value));
const round = (value, digits = 4) => Number(value.toFixed(digits));
const weaknessPriority = (signal) => round(
  clamp(signal.recurrence) * 0.35
  + clamp(signal.evaluationLoss) * 0.25
  + clamp(signal.recency) * 0.2
  + clamp(signal.timePressure) * 0.1
  + clamp(signal.failedAttempts) * 0.1,
);

class StockfishLiteCli {
  constructor() {
    this.process = null;
    this.waiters = [];
    this.tempDirectory = null;
  }

  async start() {
    this.tempDirectory = await mkdtemp(join(tmpdir(), "chesscoach-stockfish-lite-"));
    const enginePath = join(this.tempDirectory, "stockfish-lite.cjs");
    const wasmPath = join(this.tempDirectory, "stockfish-lite.wasm");
    await copyFile(join(ROOT, "public", "engine", "stockfish-18-lite-single.js"), enginePath);
    await copyFile(join(ROOT, "public", "engine", "stockfish-18-lite-single.wasm"), wasmPath);

    this.process = spawn(process.execPath, [enginePath], {
      cwd: this.tempDirectory,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdoutBuffer = "";
    this.process.stdout.setEncoding("utf8");
    this.process.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) this.onLine(line.trim());
    });
    this.process.stderr.on("data", () => undefined);

    const uciReady = this.waitFor((line) => line === "uciok");
    this.send("uci");
    await uciReady;
    const engineReady = this.waitFor((line) => line === "readyok");
    this.send("setoption name Hash value 16");
    this.send("setoption name MultiPV value 1");
    this.send("isready");
    await engineReady;
  }

  async analyze(fen) {
    const result = this.waitFor((line) => line.startsWith("bestmove "));
    this.send("position fen " + fen);
    this.send(`go nodes ${NODES_PER_POSITION}`);
    const lines = await result;
    const info = [...lines].reverse().find((line) => line.startsWith("info ") && line.includes(" score "));
    const bestMoveLine = lines.find((line) => line.startsWith("bestmove ")) ?? "bestmove";
    const mate = Number(info?.match(/score mate (-?\d+)/)?.[1]);
    const cp = Number(info?.match(/score cp (-?\d+)/)?.[1]);
    return {
      evaluationCp: Number.isFinite(cp) ? cp : Number.isFinite(mate) ? Math.sign(mate) * 10_000 : 0,
      bestMove: bestMoveLine.split(" ")[1] ?? "",
    };
  }

  waitFor(predicate) {
    return new Promise((resolvePromise, rejectPromise) => {
      const timeout = setTimeout(() => {
        this.waiters = this.waiters.filter((waiter) => waiter.resolve !== resolvePromise);
        rejectPromise(new Error("Stockfish Lite n’a pas répondu dans le délai prévu."));
      }, 30_000);
      this.waiters.push({ predicate, resolve: resolvePromise, timeout, lines: [] });
    });
  }

  onLine(line) {
    for (const waiter of [...this.waiters]) {
      waiter.lines.push(line);
      if (!waiter.predicate(line)) continue;
      clearTimeout(waiter.timeout);
      this.waiters = this.waiters.filter((candidate) => candidate !== waiter);
      waiter.resolve(waiter.lines);
    }
  }

  send(command) {
    this.process?.stdin.write(command + "\n");
  }

  async stop() {
    if (this.process && !this.process.killed) {
      const exited = new Promise((resolvePromise) => {
        this.process.once("exit", resolvePromise);
      });
      this.send("quit");
      await Promise.race([
        exited,
        new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000)),
      ]);
      if (!this.process.killed) this.process.kill();
    }
    if (this.tempDirectory) await rm(this.tempDirectory, { recursive: true, force: true });
  }
}

async function fetchRecentGames() {
  const archivesResponse = await fetch(
    `https://api.chess.com/pub/player/${encodeURIComponent(USERNAME)}/games/archives`,
    { headers: HEADERS },
  );
  if (!archivesResponse.ok) throw new Error(`Chess.com archives: HTTP ${archivesResponse.status}`);
  const { archives } = await archivesResponse.json();
  const cutoff = Date.now() - LOOKBACK_DAYS * 86_400_000;
  const games = [];

  for (const archive of archives.slice(-6).reverse()) {
    if (games.length >= MAX_GAMES) break;
    const response = await fetch(archive, { headers: HEADERS });
    if (!response.ok) continue;
    const payload = await response.json();
    for (const game of [...payload.games].reverse()) {
      if (games.length >= MAX_GAMES) break;
      if (!["rapid", "blitz"].includes(game.time_class)) continue;
      if (game.end_time * 1000 < cutoff) continue;
      const isWhite = game.white.username.toLowerCase() === USERNAME;
      const isBlack = game.black.username.toLowerCase() === USERNAME;
      if (!isWhite && !isBlack) continue;
      games.push({
        id: game.uuid ?? game.url ?? String(game.end_time),
        url: game.url,
        playedAt: new Date(game.end_time * 1000).toISOString(),
        timeClass: game.time_class,
        playerColor: isWhite ? "w" : "b",
        playerRating: isWhite ? game.white.rating : game.black.rating,
        pgn: game.pgn,
      });
    }
  }
  return games;
}

function parseClockSeconds(comment) {
  const match = comment?.match(/\[%clk\s+(\d+):(\d+):([\d.]+)\]/);
  if (!match) return null;
  return Number(match[1]) * 3_600 + Number(match[2]) * 60 + Number(match[3]);
}

function classifyError({ ply, loss, pieceCount, timePressure }) {
  if (ply <= 20) return "openings";
  if (pieceCount <= 10) return "endgames";
  if (timePressure && loss >= 100) return "time";
  if (loss >= 150) return "tactics";
  return "strategy";
}

async function analyzeGames(engine, games) {
  const errors = [];
  for (const game of games) {
    const parsed = new Chess();
    parsed.loadPgn(game.pgn);
    const history = parsed.history({ verbose: true });
    const commentsByFen = new Map(parsed.getComments().map((entry) => [entry.fen, entry.comment]));
    const board = new Chess();

    for (let index = 0; index < history.length; index += 1) {
      const move = history[index];
      const beforeFen = board.fen();
      const movingColor = board.turn();
      board.move(move);
      if (movingColor !== game.playerColor || index < 6 || index > 90) continue;

      const before = await engine.analyze(beforeFen);
      const after = await engine.analyze(board.fen());
      const playerAfter = -after.evaluationCp;
      const playedMove = `${move.from}${move.to}${move.promotion ?? ""}`;
      const loss = playedMove === before.bestMove
        ? 0
        : Math.max(0, Math.min(600, before.evaluationCp - playerAfter));
      if (loss < 60) continue;

      const pieceCount = board.board().flat().filter(Boolean).length;
      const clockSeconds = parseClockSeconds(commentsByFen.get(board.fen()));
      const timePressure = clockSeconds !== null && clockSeconds < 30;
      const area = classifyError({
        ply: index + 1,
        loss,
        pieceCount,
        timePressure,
      });
      errors.push({
        id: `${game.id}-${index + 1}`,
        gameUrl: game.url,
        playedAt: game.playedAt,
        timeClass: game.timeClass,
        area,
        fen: beforeFen,
        playedMove,
        bestMove: before.bestMove,
        centipawnLoss: Math.round(loss),
        timePressure,
        ply: index + 1,
      });
    }
  }
  return errors;
}

function buildSignals(errors) {
  const total = Math.max(1, errors.length);
  return Object.keys(AREA_LABELS).flatMap((area) => {
    const areaErrors = errors.filter((error) => error.area === area);
    if (!areaErrors.length) return [];
    const averageLoss = areaErrors.length
      ? areaErrors.reduce((sum, error) => sum + error.centipawnLoss, 0) / areaErrors.length
      : 0;
    const newestAgeDays = areaErrors.length
      ? Math.max(0, (Date.now() - Date.parse(areaErrors[0].playedAt)) / 86_400_000)
      : LOOKBACK_DAYS;
    const signal = {
      id: `weekly-${area}`,
      area,
      label: AREA_LABELS[area],
      recurrence: clamp(areaErrors.length / total * 2.5),
      evaluationLoss: clamp(averageLoss / 300),
      recency: clamp(1 - newestAgeDays / LOOKBACK_DAYS),
      timePressure: areaErrors.filter((error) => error.timePressure).length / areaErrors.length,
      failedAttempts: 0,
    };
    return { ...signal, priority: weaknessPriority(signal) };
  }).sort((left, right) => right.priority - left.priority);
}

function buildExercises(errors) {
  return [...errors]
    .sort((left, right) => right.centipawnLoss - left.centipawnLoss)
    .slice(0, 6)
    .map((error, index) => ({
      id: `personal-${error.id}`,
      title: index === 0 ? "Votre position critique de la semaine" : AREA_LABELS[error.area],
      area: error.area,
      fen: error.fen,
      sideToMove: error.fen.includes(" w ") ? "white" : "black",
      expectedMoves: [error.bestMove],
      explanation: `Vous avez joué ${error.playedMove}. Cherchez d’abord le meilleur candidat sans moteur, puis comparez avec ${error.bestMove}.`,
      source: "personal",
      sourceUrl: error.gameUrl,
      dueAt: new Date(Date.now() + (index + 1) * 86_400_000).toISOString(),
      intervalDays: 1,
      centipawnLoss: error.centipawnLoss,
    }));
}

function updateProfile(signals, games) {
  const blitzRating = games.find((game) => game.timeClass === "blitz")?.playerRating ?? 0;
  const ratings = { openings: blitzRating, tactics: blitzRating, strategy: blitzRating, endgames: blitzRating, time: blitzRating };
  for (const signal of signals) {
    ratings[signal.area] = Math.max(400, Math.round(blitzRating - signal.priority * 220));
  }
  const focusAreas = signals.slice(0, 2).map((signal) => signal.label);
  const lowPriority = [...signals].sort((a, b) => a.priority - b.priority).slice(0, 2);
  return {
    id: USERNAME,
    chessComUsername: USERNAME,
    displayName: USERNAME,
    blitzRating,
    blitzPeak: Math.max(blitzRating, ...games.map((game) => game.playerRating ?? 0)),
    targetRating: Number(process.env.CHESSCOACH_TARGET_RATING ?? 1500),
    dailyMinutes: Number(process.env.CHESSCOACH_DAILY_MINUTES ?? 20),
    skillRatings: ratings,
    focusAreas,
    strengths: lowPriority.map((signal) => AREA_LABELS[signal.area]),
    latestGameCount: games.length,
  };
}

function buildProgram(profile, signals, exercises, startDate, sourceGameCount) {
  const sessions = [];
  const matchDays = new Set([2, 5, 9, 12]);
  const focusSignals = signals.slice(0, 3);
  for (let index = 0; index < 14; index += 1) {
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + index);
    const dateKey = date.toISOString().slice(0, 10);
    const signal = focusSignals[index % focusSignals.length] ?? signals[0];
    const isMatchDay = matchDays.has(index);
    const exercise = exercises[index % Math.max(1, exercises.length)];
    const distinctExercises = Array.from(
      { length: Math.min(5, exercises.length) },
      (_, offset) => exercises[(index + offset) % exercises.length],
    ).filter((item, itemIndex, items) =>
      item && items.findIndex((candidate) => candidate.fen === item.fen) === itemIndex
    );
    const replayExercise = distinctExercises[0];
    const reviewExercise = distinctExercises[1] ?? replayExercise;
    const tacticExercises = distinctExercises.slice(2, 5);
    const exerciseIds = tacticExercises.length ? tacticExercises.map((item) => item.id) : exercise ? [exercise.id] : [];
    const replayStep = { id: "replay", kind: "replay", title: "Rejouer une erreur personnelle", minutes: 4, completed: false, exerciseIds: replayExercise ? [replayExercise.id] : [] };
    const reviewStep = { id: "review", kind: "review", title: "Révision espacée · 1 position", minutes: 3, completed: false, exerciseIds: reviewExercise ? [reviewExercise.id] : [] };
    const summaryStep = { id: "summary", kind: "summary", title: "Bilan et prochaine intention", minutes: 2, completed: false };
    const miniGame = (minutes, title) => ({ id: "mini-game", kind: "mini-game", title, minutes, completed: false, startFen: replayExercise?.fen });
    const stepsByFocus = {
      tactics: [
        replayStep,
        reviewStep,
        { id: "exercise", kind: "exercise", title: `Sprint tactique · ${exerciseIds.length} positions`, minutes: 6, completed: false, exerciseIds },
        miniGame(5, "Conversion depuis la position critique"),
        summaryStep,
      ],
      strategy: [
        { ...replayStep, minutes: 5, title: "Diagnostiquer une décision de milieu de jeu" },
        { id: "exercise", kind: "exercise", title: `Comparer les plans · ${exerciseIds.length} positions`, minutes: 7, completed: false, exerciseIds },
        miniGame(6, "Mini-partie avec objectif positionnel"),
        summaryStep,
      ],
      time: [
        replayStep,
        reviewStep,
        { id: "exercise", kind: "exercise", title: `Décision rapide · ${exerciseIds.length} positions`, minutes: 5, completed: false, exerciseIds },
        miniGame(6, "Mini-partie sous contrainte de temps"),
        summaryStep,
      ],
      openings: [
        { ...reviewStep, minutes: 4, title: "Retrouver le plan après l’ouverture" },
        { id: "exercise", kind: "exercise", title: `Sortie d’ouverture · ${exerciseIds.length} positions`, minutes: 6, completed: false, exerciseIds },
        miniGame(8, "Partie depuis la fin de l’ouverture"),
        summaryStep,
      ],
      endgames: [
        { ...replayStep, minutes: 5, title: "Rejouer une conversion manquée" },
        { id: "exercise", kind: "exercise", title: `Technique de finale · ${exerciseIds.length} positions`, minutes: 7, completed: false, exerciseIds },
        miniGame(6, "Finale pratique contre le coach"),
        summaryStep,
      ],
    };

    sessions.push({
      id: `${profile.id}-${dateKey}`,
      date: dateKey,
      durationMinutes: isMatchDay ? 5 : 20,
      contentVersion: 2,
      sessionKind: isMatchDay ? "match" : "training",
      focus: signal.area,
      headline: isMatchDay ? "Partie dirigée sur Chess.com" : signal.label,
      rationale: isMatchDay
        ? `Une partie réelle pour tester ${signal.label.toLowerCase()} sans ajouter de fatigue d’entraînement.`
        : `Cette séance consolide ${signal.label.toLowerCase()} à partir des positions récentes.`,
      playMission: `Pendant la partie, verbalisez deux candidats et contrôlez la réponse adverse avant chaque coup critique.`,
      steps: isMatchDay
        ? [
          { id: "review", kind: "review", title: "Relire la mission de jeu", minutes: 3, completed: false },
          { id: "summary", kind: "summary", title: "Noter le ressenti après la partie", minutes: 2, completed: false },
        ]
        : stepsByFocus[signal.area],
    });
  }
  return {
    id: `${profile.id}-${sessions[0].date}-14d`,
    startDate: sessions[0].date,
    endDate: sessions.at(-1).date,
    sourceGameCount,
    sessions,
  };
}

function buildSnapshot(games, errors) {
  const signals = buildSignals(errors);
  const exercises = buildExercises(errors);
  const profile = updateProfile(signals, games);
  const program = buildProgram(profile, signals, exercises, new Date(), games.length);
  return {
    generatedAt: new Date().toISOString(),
    analysis: {
      engine: "Stockfish 18 Lite",
      runtime: "WASM local",
      gamesAnalyzed: games.length,
      positionsFlagged: errors.length,
      lookbackDays: LOOKBACK_DAYS,
      lastGameAt: games[0]?.playedAt ?? null,
      guardrail: "fresh-live-data-only",
    },
    profile,
    signals,
    exercises,
    program,
    metrics: {
      currentRating: profile.blitzRating,
      importedGames: games.length,
      analyzedGames: games.length,
      positionsFlagged: errors.length,
    },
  };
}

function buildReport(snapshot) {
  const focus = snapshot.signals[0];
  const exercise = snapshot.exercises[0];
  return `# Revue ChessCoach — ${snapshot.generatedAt.slice(0, 10)}

## Décision

- Focus principal : **${focus.label}**
- Priorité calculée : **${Math.round(focus.priority * 100)} %**
- Parties rapid/blitz analysées : **${snapshot.analysis.gamesAnalyzed}**
- Positions à revoir : **${snapshot.analysis.positionsFlagged ?? 0}**
- Programme généré : **${snapshot.program.sessions.length} jours**
- Moteur : **Stockfish 18 Lite/WASM**, sans serveur d’échecs

## Exercice prioritaire

- ${exercise.title}
- Perte observée : ${exercise.centipawnLoss ?? "référence initiale"} centipions
- Source : ${exercise.sourceUrl ?? "programme initial"}

## Garde-fous

- Le focus ne change pas sur moins de 5 parties.
- Aucun PGN ni nom d’adversaire n’est enregistré dans le dépôt.
- Le classement cible reste fixé à ${snapshot.profile.targetRating}.
`;
}

async function main() {
  if (!USERNAME) throw new Error("CHESSCOACH_USERNAME est requis.");
  const games = await fetchRecentGames();
  if (!games.length) {
    console.log("Aucune nouvelle partie rapid/blitz dans la période.");
    return;
  }

  const engine = new StockfishLiteCli();
  try {
    await engine.start();
    const errors = await analyzeGames(engine, games);
    if (!errors.length) {
      console.log("Aucune position critique détectée dans les parties analysées.");
      return;
    }
    const snapshot = buildSnapshot(games, errors);
    const report = buildReport(snapshot);
    if (!DRY_RUN) {
      await mkdir(dirname(EXPORT_PATH), { recursive: true });
      await mkdir(dirname(REPORT_PATH), { recursive: true });
      await writeFile(EXPORT_PATH, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
      await writeFile(REPORT_PATH, report, "utf8");
    }
    console.log(JSON.stringify({
      dryRun: DRY_RUN,
      gamesAnalyzed: games.length,
      positionsFlagged: errors.length,
      focus: snapshot.signals[0].area,
      exercises: snapshot.exercises.length,
    }));
  } finally {
    await engine.stop();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

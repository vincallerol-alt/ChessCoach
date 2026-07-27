"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard, type Arrow } from "react-chessboard";
import { StockfishLiteAdapter } from "../../lib/stockfish-lite";
import type { BotGameSummary, CriticalPosition, SkillArea } from "../../lib/types";

type BoardMode = "bot" | "exercise";

type Props = {
  mode?: BoardMode;
  fen?: string;
  expectedMove?: string;
  onExerciseResult?: (correct: boolean, move: string) => void;
  onGameComplete?: (game: BotGameSummary) => void;
  onPositionChange?: (fen: string) => void;
  coachArrows?: Arrow[];
};

const timeControls = {
  "3+2": { label: "3 min + 2 s", initialMs: 180_000, incrementMs: 2_000 },
  "5+0": { label: "5 min", initialMs: 300_000, incrementMs: 0 },
  "10+0": { label: "10 min", initialMs: 600_000, incrementMs: 0 },
  "15+10": { label: "15 min + 10 s", initialMs: 900_000, incrementMs: 10_000 },
  unlimited: { label: "Sans pendule", initialMs: null, incrementMs: 0 },
} as const;

type TimeControl = keyof typeof timeControls;
type ClockState = { white: number; black: number };

const coachPosition = "r2q1rk1/pp1nbppp/2p1pn2/3p4/3P1B2/2NBPN2/PPQ2PPP/R3K2R w KQ - 2 10";
const exerciseStatus = (position?: string) =>
  new Chess(position ?? coachPosition).turn() === "w"
    ? "Trouvez le plan des Blancs"
    : "Trouvez le plan des Noirs";

const formatClock = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export function ChessBoardPanel({ mode = "bot", fen, expectedMove = "e1c1", onExerciseResult, onGameComplete, onPositionChange, coachArrows = [] }: Props) {
  const gameRef = useRef(new Chess(fen ?? (mode === "exercise" ? coachPosition : undefined)));
  const humanColor = useMemo<"w" | "b">(
    () => mode === "bot" && fen ? new Chess(fen).turn() : "w",
    [fen, mode],
  );
  const engineRef = useRef<StockfishLiteAdapter | null>(null);
  const analysisEngineRef = useRef<StockfishLiteAdapter | null>(null);
  const analysisQueueRef = useRef<Promise<CriticalPosition[]>>(Promise.resolve([]));
  const analysisCountRef = useRef(0);
  const [position, setPosition] = useState(() => new Chess(fen ?? (mode === "exercise" ? coachPosition : undefined)).fen());
  const [selected, setSelected] = useState<Square | null>(null);
  const [status, setStatus] = useState(mode === "bot"
    ? fen ? `Position critique · vous jouez les ${humanColor === "w" ? "Blancs" : "Noirs"}` : "À vous de jouer"
    : exerciseStatus(fen));
  const [engineState, setEngineState] = useState<"loading" | "ready" | "fallback">("loading");
  const [skill, setSkill] = useState(7);
  const [timeControl, setTimeControl] = useState<TimeControl>("5+0");
  const [clocks, setClocks] = useState<ClockState>({ white: 300_000, black: 300_000 });
  const [clockRunning, setClockRunning] = useState(false);
  const timedOutRef = useRef(false);
  const completedGameRef = useRef(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [exerciseLocked, setExerciseLocked] = useState(false);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const activeTurn = useMemo(() => new Chess(position).turn(), [position]);
  const playerClockColor = humanColor === "w" ? "white" : "black";
  const coachClockColor = humanColor === "w" ? "black" : "white";

  const currentResult = useCallback((): BotGameSummary["result"] => {
    if (gameRef.current.isDraw()) return "draw";
    return gameRef.current.turn() === humanColor ? "loss" : "win";
  }, [humanColor]);

  useEffect(() => {
    onPositionChange?.(position);
  }, [onPositionChange, position]);

  const finishGame = useCallback((result: BotGameSummary["result"]) => {
    if (mode !== "bot" || completedGameRef.current) return;
    completedGameRef.current = true;
    setGameCompleted(true);
    setClockRunning(false);
    setStatus("Partie terminée · analyse locale en cours…");
    const timeClass: BotGameSummary["timeClass"] = timeControl === "3+2" || timeControl === "5+0"
      ? "blitz"
      : timeControl === "10+0" || timeControl === "15+10"
        ? "rapid"
        : "other";
    const summary = {
      pgn: gameRef.current.pgn(),
      result,
      timeClass,
      timeControl,
      playerColor: humanColor === "w" ? "white" as const : "black" as const,
      playedAt: new Date().toISOString(),
    };
    void analysisQueueRef.current.then((positions) => {
      onGameComplete?.({
        ...summary,
        criticalPositions: [...positions].sort((left, right) => right.centipawnLoss - left.centipawnLoss).slice(0, 3),
      });
      setStatus("Partie enregistrée · positions critiques prêtes");
    }).catch(() => {
      onGameComplete?.({ ...summary, criticalPositions: [] });
      setStatus("Partie enregistrée");
    });
  }, [humanColor, mode, onGameComplete, timeControl]);

  useEffect(() => {
    if (mode !== "bot") return;
    const engine = new StockfishLiteAdapter();
    const analysisEngine = new StockfishLiteAdapter();
    engineRef.current = engine;
    analysisEngineRef.current = analysisEngine;
    engine.ready().then(() => setEngineState("ready")).catch(() => setEngineState("fallback"));
    analysisEngine.ready().catch(() => undefined);
    return () => {
      engine.dispose();
      analysisEngine.dispose();
    };
  }, [mode]);

  const queueMoveAnalysis = useCallback((beforeFen: string, afterFen: string, playedMove: string, ply: number, underTimePressure: boolean) => {
    if (analysisCountRef.current >= 24) return;
    analysisCountRef.current += 1;
    const classify = (loss: number): SkillArea => {
      if (underTimePressure) return "time";
      if (ply <= 20) return "openings";
      const pieceCount = beforeFen.split(" ")[0].replace(/[1-8/]/g, "").length;
      if (pieceCount <= 10) return "endgames";
      return loss >= 140 ? "tactics" : "strategy";
    };
    analysisQueueRef.current = analysisQueueRef.current.then(async (positions) => {
      try {
        await new Promise((resolve) => window.setTimeout(resolve, 550));
        const engine = analysisEngineRef.current;
        if (!engine) return positions;
        const before = await engine.analyze(beforeFen, 8, 1);
        const after = await engine.analyze(afterFen, 8, 1);
        const loss = Math.max(0, Math.round(before.evaluationCp + after.evaluationCp));
        if (before.bestMove === playedMove || loss < 60) return positions;
        return [...positions, {
          fen: beforeFen,
          ply,
          playedMove,
          bestMove: before.bestMove,
          centipawnLoss: loss,
          area: classify(loss),
        }];
      } catch {
        return positions;
      }
    });
  }, []);

  useEffect(() => {
    if (mode !== "bot" || !clockRunning || timeControls[timeControl].initialMs === null) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = now - previous;
      previous = now;
      const active = gameRef.current.turn() === "w" ? "white" : "black";
      setClocks((current) => {
        const remaining = Math.max(0, current[active] - elapsed);
        if (remaining === 0) {
          timedOutRef.current = true;
          setClockRunning(false);
          const playerTimedOut = active === playerClockColor;
          setStatus(playerTimedOut ? "Temps écoulé — le coach gagne" : "Temps écoulé — vous gagnez");
          window.setTimeout(() => finishGame(playerTimedOut ? "loss" : "win"), 0);
        }
        return { ...current, [active]: remaining };
      });
    }, 200);
    return () => window.clearInterval(timer);
  }, [clockRunning, finishGame, mode, playerClockColor, timeControl]);

  const legalTargets = useMemo(() => {
    if (!selected) return [] as Square[];
    return new Chess(position).moves({ square: selected, verbose: true }).map((move) => move.to);
  }, [selected, position]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    if (selected) styles[selected] = { boxShadow: "inset 0 0 0 4px rgba(242, 184, 75, .82)" };
    legalTargets.forEach((square) => {
      styles[square] = { background: "radial-gradient(circle, rgba(24,37,31,.42) 0 16%, transparent 18%)" };
    });
    return styles;
  }, [selected, legalTargets]);

  const fallbackMove = useCallback(() => {
    const moves = gameRef.current.moves({ verbose: true });
    if (!moves.length) return null;
    const captures = moves.filter((move) => move.isCapture());
    const pool = captures.length ? captures : moves;
    return pool[Math.floor(Math.random() * pool.length)];
  }, []);

  const playBot = useCallback(async () => {
    if (gameRef.current.isGameOver() || timedOutRef.current) return;
    setStatus("Le coach réfléchit…");
    try {
      const uci = await engineRef.current?.bestMove(gameRef.current.fen(), skill, 500);
      if (!uci || uci === "(none)") throw new Error("no move");
      gameRef.current.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || "q" });
    } catch {
      const move = fallbackMove();
      if (move) gameRef.current.move(move);
      setEngineState("fallback");
    }
    if (timedOutRef.current) return;
    const engineClock = humanColor === "w" ? "black" : "white";
    setClocks((current) => ({ ...current, [engineClock]: current[engineClock] + timeControls[timeControl].incrementMs }));
    setPosition(gameRef.current.fen());
    setMoveHistory(gameRef.current.history());
    setStatus(gameRef.current.isGameOver() ? "Partie terminée" : "À vous de jouer");
    if (gameRef.current.isGameOver()) {
      finishGame(currentResult());
    }
  }, [currentResult, fallbackMove, finishGame, humanColor, skill, timeControl]);

  const tryMove = useCallback((source: Square, target: Square) => {
    if (timedOutRef.current || exerciseLocked || (mode === "bot" && gameRef.current.turn() !== humanColor)) return false;
    let move;
    const beforeFen = gameRef.current.fen();
    const playerClock = humanColor === "w" ? clocks.white : clocks.black;
    const underTimePressure = mode === "bot" && timeControls[timeControl].initialMs !== null && playerClock <= 30_000;
    try {
      move = gameRef.current.move({ from: source, to: target, promotion: "q" });
    } catch {
      return false;
    }
    if (!move) return false;
    const uci = `${source}${target}${move.promotion ?? ""}`;
    const afterFen = gameRef.current.fen();
    setPosition(afterFen);
    setMoveHistory(gameRef.current.history());
    setSelected(null);
    if (mode === "exercise") {
      const correct = uci.startsWith(expectedMove);
      setExerciseLocked(true);
      setStatus(correct ? "Excellent — meilleur candidat trouvé." : "Ce coup ne répond pas au problème. Demandez un indice ou réessayez.");
      onExerciseResult?.(correct, uci);
    } else {
      setHasStarted(true);
      queueMoveAnalysis(beforeFen, afterFen, uci, gameRef.current.history().length, underTimePressure);
      const playerClock = humanColor === "w" ? "white" : "black";
      setClocks((current) => ({ ...current, [playerClock]: current[playerClock] + timeControls[timeControl].incrementMs }));
      setClockRunning(true);
      if (gameRef.current.isGameOver()) {
        finishGame(currentResult());
      } else {
        window.setTimeout(playBot, 180);
      }
    }
    return true;
  }, [clocks.black, clocks.white, currentResult, exerciseLocked, expectedMove, finishGame, humanColor, mode, onExerciseResult, playBot, queueMoveAnalysis, timeControl]);

  const onSquareClick = useCallback(({ square }: { square: string }) => {
    if (exerciseLocked) return;
    const target = square as Square;
    if (selected) {
      if (tryMove(selected, target)) return;
      setSelected(null);
    }
    const piece = gameRef.current.get(target);
    if (piece && piece.color === gameRef.current.turn()) setSelected(target);
  }, [exerciseLocked, selected, tryMove]);

  const reset = () => {
    gameRef.current = new Chess(fen ?? (mode === "exercise" ? coachPosition : undefined));
    setPosition(gameRef.current.fen());
    setSelected(null);
    setStatus(mode === "bot" ? "À vous de jouer" : exerciseStatus(fen));
    setExerciseLocked(false);
    setMoveHistory([]);
    const initial = timeControls[timeControl].initialMs ?? 0;
    setClocks({ white: initial, black: initial });
    setClockRunning(false);
    timedOutRef.current = false;
    completedGameRef.current = false;
    analysisQueueRef.current = Promise.resolve([]);
    analysisCountRef.current = 0;
    setHasStarted(false);
    setGameCompleted(false);
  };

  const changeTimeControl = (next: TimeControl) => {
    setTimeControl(next);
    const initial = timeControls[next].initialMs ?? 0;
    setClocks({ white: initial, black: initial });
    setClockRunning(false);
    timedOutRef.current = false;
    completedGameRef.current = false;
    analysisQueueRef.current = Promise.resolve([]);
    analysisCountRef.current = 0;
    setHasStarted(false);
    setGameCompleted(false);
    gameRef.current = new Chess(fen);
    setPosition(gameRef.current.fen());
    setSelected(null);
    setStatus(fen ? `Position critique · vous jouez les ${humanColor === "w" ? "Blancs" : "Noirs"}` : "À vous de jouer");
  };

  const resign = () => {
    if (!hasStarted || completedGameRef.current) return;
    setStatus("Partie abandonnée — enregistrée dans votre historique");
    finishGame("loss");
  };

  return (
    <section className="board-card" aria-label="Échiquier ChessCoach">
      <div className="board-toolbar">
        <div>
          <span className={`engine-dot ${engineState}`} />
          <strong>{mode === "bot" ? "Coach Bot" : "Position personnelle"}</strong>
          <small>{mode === "bot"
            ? `Stockfish 18 Lite · niveau ${skill}`
            : `${new Chess(position).turn() === "w" ? "Blancs" : "Noirs"} au trait`}</small>
        </div>
        <div className="board-actions">
          {mode === "bot" && hasStarted && !gameCompleted && (
            <button className="resign-button" type="button" onClick={resign}>Abandonner</button>
          )}
          <button className="icon-button" type="button" onClick={reset} aria-label="Recommencer">↻</button>
        </div>
      </div>
      {mode === "bot" && timeControl !== "unlimited" && (
        <div className="chess-clocks" aria-label="Pendules">
          <div className={activeTurn === (coachClockColor === "white" ? "w" : "b") && clockRunning ? "active" : ""}>
            <span>Coach</span><strong>{formatClock(clocks[coachClockColor])}</strong>
          </div>
          <div className={activeTurn === (playerClockColor === "white" ? "w" : "b") && clockRunning ? "active" : ""}>
            <span>Vous</span><strong>{formatClock(clocks[playerClockColor])}</strong>
          </div>
        </div>
      )}
      <div className="board-wrap">
        <Chessboard options={{
          id: `chesscoach-${mode}`,
          position,
          boardOrientation: humanColor === "w" ? "white" : "black",
          onPieceDrop: ({ sourceSquare, targetSquare }) => Boolean(targetSquare && tryMove(sourceSquare as Square, targetSquare as Square)),
          onSquareClick,
          canDragPiece: ({ square }) => {
            if (!square) return false;
            const piece = gameRef.current.get(square as Square);
            return Boolean(!timedOutRef.current && !exerciseLocked && piece && piece.color === gameRef.current.turn() && (mode !== "bot" || piece.color === humanColor));
          },
          squareStyles,
          arrows: coachArrows,
          allowDrawingArrows: false,
          darkSquareStyle: { backgroundColor: "#769656" },
          lightSquareStyle: { backgroundColor: "#eeeed2" },
          boardStyle: { borderRadius: "8px", boxShadow: "0 16px 44px rgba(0,0,0,.28)", touchAction: "none" },
          animationDurationInMs: 160,
          showNotation: true,
        }} />
      </div>
      {mode === "bot" && moveHistory.length > 0 && (
        <div className="move-strip" aria-label="Derniers coups">
          {moveHistory.slice(-8).map((move, index) => <span key={`${move}-${index}`}>{move}</span>)}
        </div>
      )}
      <div className="board-status" aria-live="polite">
        <span>{status}</span>
        {mode === "bot" && (
          <div className="board-options">
            <label>
              Cadence
              <select value={timeControl} onChange={(event) => changeTimeControl(event.target.value as TimeControl)}>
                {Object.entries(timeControls).map(([value, control]) => (
                  <option key={value} value={value}>{control.label}</option>
                ))}
              </select>
            </label>
            <label>
              Force
              <select value={skill} onChange={(event) => setSkill(Number(event.target.value))}>
                <option value="2">Débutant</option>
                <option value="7">Intermédiaire</option>
                <option value="12">Avancé</option>
                <option value="18">Expert</option>
              </select>
            </label>
          </div>
        )}
      </div>
    </section>
  );
}

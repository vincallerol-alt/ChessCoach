"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { StockfishLiteAdapter } from "../../lib/stockfish-lite";
import type { BotGameSummary } from "../../lib/types";

type BoardMode = "bot" | "exercise";

type Props = {
  mode?: BoardMode;
  fen?: string;
  expectedMove?: string;
  onExerciseResult?: (correct: boolean, move: string) => void;
  onGameComplete?: (game: BotGameSummary) => void;
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

export function ChessBoardPanel({ mode = "bot", fen, expectedMove = "e1c1", onExerciseResult, onGameComplete }: Props) {
  const gameRef = useRef(new Chess(fen ?? (mode === "exercise" ? coachPosition : undefined)));
  const engineRef = useRef<StockfishLiteAdapter | null>(null);
  const [position, setPosition] = useState(() => new Chess(fen ?? (mode === "exercise" ? coachPosition : undefined)).fen());
  const [selected, setSelected] = useState<Square | null>(null);
  const [status, setStatus] = useState(mode === "bot" ? "À vous de jouer" : exerciseStatus(fen));
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
  const activeTurn = useMemo(() => new Chess(position).turn(), [position]);

  const finishGame = useCallback((result: BotGameSummary["result"]) => {
    if (mode !== "bot" || completedGameRef.current) return;
    completedGameRef.current = true;
    setGameCompleted(true);
    setClockRunning(false);
    const timeClass = timeControl === "3+2" || timeControl === "5+0"
      ? "blitz"
      : timeControl === "10+0" || timeControl === "15+10"
        ? "rapid"
        : "other";
    onGameComplete?.({
      pgn: gameRef.current.pgn(),
      result,
      timeClass,
      timeControl,
      playedAt: new Date().toISOString(),
    });
  }, [mode, onGameComplete, timeControl]);

  useEffect(() => {
    if (mode !== "bot") return;
    const engine = new StockfishLiteAdapter();
    engineRef.current = engine;
    engine.ready().then(() => setEngineState("ready")).catch(() => setEngineState("fallback"));
    return () => engine.dispose();
  }, [mode]);

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
          setStatus(active === "white" ? "Temps écoulé — le coach gagne" : "Temps écoulé — vous gagnez");
          window.setTimeout(() => finishGame(active === "white" ? "loss" : "win"), 0);
        }
        return { ...current, [active]: remaining };
      });
    }, 200);
    return () => window.clearInterval(timer);
  }, [clockRunning, finishGame, mode, timeControl]);

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
    setClocks((current) => ({ ...current, black: current.black + timeControls[timeControl].incrementMs }));
    setPosition(gameRef.current.fen());
    setStatus(gameRef.current.isGameOver() ? "Partie terminée" : "À vous de jouer");
    if (gameRef.current.isGameOver()) {
      const result = gameRef.current.isDraw() ? "draw" : gameRef.current.turn() === "w" ? "loss" : "win";
      finishGame(result);
    }
  }, [fallbackMove, finishGame, skill, timeControl]);

  const tryMove = useCallback((source: Square, target: Square) => {
    if (timedOutRef.current || exerciseLocked || (mode === "bot" && gameRef.current.turn() !== "w")) return false;
    let move;
    try {
      move = gameRef.current.move({ from: source, to: target, promotion: "q" });
    } catch {
      return false;
    }
    if (!move) return false;
    const uci = `${source}${target}${move.promotion ?? ""}`;
    setPosition(gameRef.current.fen());
    setSelected(null);
    if (mode === "exercise") {
      const correct = uci.startsWith(expectedMove);
      setExerciseLocked(true);
      setStatus(correct ? "Excellent — meilleur candidat trouvé." : "Ce coup ne répond pas au problème. Demandez un indice ou réessayez.");
      onExerciseResult?.(correct, uci);
    } else {
      setHasStarted(true);
      setClocks((current) => ({ ...current, white: current.white + timeControls[timeControl].incrementMs }));
      setClockRunning(true);
      if (gameRef.current.isGameOver()) {
        const result = gameRef.current.isDraw() ? "draw" : gameRef.current.turn() === "w" ? "loss" : "win";
        finishGame(result);
      } else {
        window.setTimeout(playBot, 180);
      }
    }
    return true;
  }, [exerciseLocked, expectedMove, finishGame, mode, onExerciseResult, playBot, timeControl]);

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
    const initial = timeControls[timeControl].initialMs ?? 0;
    setClocks({ white: initial, black: initial });
    setClockRunning(false);
    timedOutRef.current = false;
    completedGameRef.current = false;
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
    setHasStarted(false);
    setGameCompleted(false);
    gameRef.current = new Chess();
    setPosition(gameRef.current.fen());
    setSelected(null);
    setStatus("À vous de jouer");
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
          <div className={activeTurn === "b" && clockRunning ? "active" : ""}>
            <span>Coach</span><strong>{formatClock(clocks.black)}</strong>
          </div>
          <div className={activeTurn === "w" && clockRunning ? "active" : ""}>
            <span>Vous</span><strong>{formatClock(clocks.white)}</strong>
          </div>
        </div>
      )}
      <div className="board-wrap">
        <Chessboard options={{
          id: `chesscoach-${mode}`,
          position,
          onPieceDrop: ({ sourceSquare, targetSquare }) => Boolean(targetSquare && tryMove(sourceSquare as Square, targetSquare as Square)),
          onSquareClick,
          canDragPiece: ({ square }) => {
            if (!square) return false;
            const piece = gameRef.current.get(square as Square);
            return Boolean(!timedOutRef.current && !exerciseLocked && piece && piece.color === gameRef.current.turn() && (mode !== "bot" || piece.color === "w"));
          },
          squareStyles,
          darkSquareStyle: { backgroundColor: "#769656" },
          lightSquareStyle: { backgroundColor: "#eeeed2" },
          boardStyle: { borderRadius: "8px", boxShadow: "0 16px 44px rgba(0,0,0,.28)", touchAction: "none" },
          animationDurationInMs: 160,
          showNotation: true,
        }} />
      </div>
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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { StockfishLiteAdapter } from "../../lib/stockfish-lite";

type BoardMode = "bot" | "exercise";

type Props = {
  mode?: BoardMode;
  fen?: string;
  expectedMove?: string;
  onExerciseResult?: (correct: boolean, move: string) => void;
};

const coachPosition = "r2q1rk1/pp1nbppp/2p1pn2/3p4/3P1B2/2NBPN2/PPQ2PPP/R3K2R w KQ - 2 10";

export function ChessBoardPanel({ mode = "bot", fen, expectedMove = "e1c1", onExerciseResult }: Props) {
  const gameRef = useRef(new Chess(fen ?? (mode === "exercise" ? coachPosition : undefined)));
  const engineRef = useRef<StockfishLiteAdapter | null>(null);
  const [position, setPosition] = useState(() => new Chess(fen ?? (mode === "exercise" ? coachPosition : undefined)).fen());
  const [selected, setSelected] = useState<Square | null>(null);
  const [status, setStatus] = useState(mode === "bot" ? "À vous de jouer" : "Trouvez le plan des Blancs");
  const [engineState, setEngineState] = useState<"loading" | "ready" | "fallback">("loading");
  const [skill, setSkill] = useState(7);

  useEffect(() => {
    if (mode !== "bot") return;
    const engine = new StockfishLiteAdapter();
    engineRef.current = engine;
    engine.ready().then(() => setEngineState("ready")).catch(() => setEngineState("fallback"));
    return () => engine.dispose();
  }, [mode]);

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
    if (gameRef.current.isGameOver()) return;
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
    setPosition(gameRef.current.fen());
    setStatus(gameRef.current.isGameOver() ? "Partie terminée" : "À vous de jouer");
  }, [fallbackMove, skill]);

  const tryMove = useCallback((source: Square, target: Square) => {
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
      setStatus(correct ? "Excellent — le roque active aussi la tour." : "Coup légal, mais cherche l’activation du roi et de la tour.");
      onExerciseResult?.(correct, uci);
    } else {
      window.setTimeout(playBot, 180);
    }
    return true;
  }, [expectedMove, mode, onExerciseResult, playBot]);

  const onSquareClick = useCallback(({ square }: { square: string }) => {
    const target = square as Square;
    if (selected) {
      if (tryMove(selected, target)) return;
      setSelected(null);
    }
    const piece = gameRef.current.get(target);
    if (piece && piece.color === gameRef.current.turn()) setSelected(target);
  }, [selected, tryMove]);

  const reset = () => {
    gameRef.current = new Chess(fen ?? (mode === "exercise" ? coachPosition : undefined));
    setPosition(gameRef.current.fen());
    setSelected(null);
    setStatus(mode === "bot" ? "À vous de jouer" : "Trouvez le plan des Blancs");
  };

  return (
    <section className="board-card" aria-label="Échiquier ChessCoach">
      <div className="board-toolbar">
        <div>
          <span className={`engine-dot ${engineState}`} />
          <strong>{mode === "bot" ? "Coach Bot" : "Position personnelle"}</strong>
          <small>{mode === "bot" ? `Stockfish 18 Lite · niveau ${skill}` : "Blancs au trait"}</small>
        </div>
        <button className="icon-button" type="button" onClick={reset} aria-label="Recommencer">↻</button>
      </div>
      <div className="board-wrap">
        <Chessboard options={{
          id: `chesscoach-${mode}`,
          position,
          onPieceDrop: ({ sourceSquare, targetSquare }) => Boolean(targetSquare && tryMove(sourceSquare as Square, targetSquare as Square)),
          onSquareClick,
          canDragPiece: ({ square }) => {
            if (!square) return false;
            const piece = gameRef.current.get(square as Square);
            return Boolean(piece && piece.color === gameRef.current.turn());
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
          <label>
            Force
            <select value={skill} onChange={(event) => setSkill(Number(event.target.value))}>
              <option value="2">Débutant</option>
              <option value="7">Intermédiaire</option>
              <option value="12">Avancé</option>
              <option value="18">Expert</option>
            </select>
          </label>
        )}
      </div>
    </section>
  );
}
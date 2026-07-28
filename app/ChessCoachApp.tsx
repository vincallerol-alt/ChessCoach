"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Chess } from "chess.js";
import { DeterministicCoachNarrator, nextReviewDate } from "../lib/coach";
import { syncCloudState, type CloudProfile } from "../lib/cloud-sync";
import { createLocalId } from "../lib/ids";
import { cacheExercises, cacheGames, cacheProfile, listAttempts, listCachedExercises, listCachedGames, listTrainingPlans, loadCachedProfile, queueAttempt, saveTrainingPlan } from "../lib/offline-db";
import { buildTrainingProgram, createEmptyProfile, deriveProfile, deriveWeaknessSignals } from "../lib/runtime-coach";
import { distinctExercises, preparePlan } from "../lib/training-plan";
import type { Attempt, BotGameSummary, Exercise, Game, PlayerProfile, SkillArea, TrainingPlan, TrainingProgram, WeaknessSignal } from "../lib/types";
import { ChessBoardPanel } from "./components/ChessBoardPanel";
import { CoachLivePanel } from "./components/CoachLivePanel";

type Tab = "today" | "play" | "training" | "games" | "progress";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const todayIso = new Date().toISOString().slice(0, 10);
const emptyProfile = createEmptyProfile();
const emptyProgram = buildTrainingProgram(emptyProfile, [], [], 0);
const initialPlan = emptyProgram.sessions[0];
const narrator = new DeterministicCoachNarrator();
const skillLabels: Record<SkillArea, string> = {
  openings: "Ouvertures",
  tactics: "Tactique",
  strategy: "Stratégie",
  endgames: "Finales",
  time: "Gestion du temps",
};

const elapsedSince = (startedAt: number) => Date.now() - startedAt;

function mergeCloudProfile(current: PlayerProfile, persisted: CloudProfile): PlayerProfile {
  return {
    ...current,
    chessComUsername: persisted.chessComUsername || current.chessComUsername,
    displayName: persisted.displayName || current.displayName,
    blitzRating: persisted.blitzRating > 0 ? persisted.blitzRating : current.blitzRating,
    blitzPeak: Math.max(current.blitzPeak, persisted.blitzPeak, persisted.blitzRating),
    targetRating: persisted.targetRating || current.targetRating,
    dailyMinutes: persisted.dailyMinutes || current.dailyMinutes,
  };
}

const navigation: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "today", label: "Aujourd’hui", icon: "⌂" },
  { id: "play", label: "Jouer", icon: "♞" },
  { id: "training", label: "Entraînement", icon: "◎" },
  { id: "games", label: "Parties", icon: "▤" },
  { id: "progress", label: "Progrès", icon: "↗" },
];

function subscribeNetwork(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}
function SkillMeter({ label, value, tone = "normal" }: { label: string; value: number; tone?: "normal" | "focus" | "strong" }) {
  const percent = Math.max(18, Math.min(100, ((value - 900) / 600) * 100));
  return (
    <div className={`skill-row ${tone}`}>
      <div><span>{label}</span><strong>{value}</strong></div>
      <div className="meter"><span style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

function TodayView({
  plan,
  profile,
  signals,
  analyzedGames,
  history,
  onStart,
}: {
  plan: TrainingPlan;
  profile: PlayerProfile;
  signals: WeaknessSignal[];
  analyzedGames: number;
  history: TrainingPlan[];
  onStart: (stepId?: string) => void;
}) {
  const completed = plan.steps.filter((step) => step.completed).length;
  const ratingGap = Math.max(0, profile.targetRating - profile.blitzRating);
  const goalProgress = Math.min(100, Math.round(profile.blitzRating / profile.targetRating * 100));
  const completedDays = new Set(history.filter((session) => session.steps.every((step) => step.completed)).map((session) => session.date));
  const topSignal = signals[0];
  return (
    <div className="view-stack">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">Séance du jour · {plan.durationMinutes} min</span>
          <h1>{plan.headline}</h1>
          <p>{plan.rationale}</p>
          <button className="primary-button" type="button" onClick={() => onStart()}>
            {completed ? "Reprendre ma séance" : "Commencer ma séance"} <span>→</span>
          </button>
        </div>
        <div className="session-ring" style={{ "--progress": `${(completed / plan.steps.length) * 360}deg` } as React.CSSProperties}>
          <div><strong>{completed}/{plan.steps.length}</strong><span>étapes</span></div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel session-panel">
          <div className="panel-heading"><div><span className="eyebrow">Programme adaptatif</span><h2>Votre parcours aujourd’hui</h2></div><span className="duration-pill">{plan.durationMinutes} min</span></div>
          <div className="steps-list">
            {plan.steps.map((step, index) => (
              <button className={`step-row ${step.completed ? "done" : ""} ${index === completed ? "active" : ""}`} key={step.id} type="button" onClick={() => onStart(step.id)}>
                <span className="step-index">{step.completed ? "✓" : index + 1}</span>
                <span><strong>{step.title}</strong><small>{step.kind === "replay" ? "Issue de vos dernières parties" : step.kind === "mini-game" ? "Depuis une position critique" : "Personnalisé par le coach"}</small></span>
                <em>{step.minutes} min</em>
              </button>
            ))}
          </div>
        </article>

        <aside className="panel coach-note">
          <div className="coach-avatar">♞</div>
          <span className="eyebrow">Le conseil du coach</span>
          <h2>{topSignal ? `Priorité : ${topSignal.label}` : "Priorité en cours de calcul"}</h2>
          <p>{narrator.explain(topSignal?.area ?? plan.focus, {})}</p>
          <div className="quote-source"><span>Observation calculée</span><strong>{analyzedGames} parties analysées</strong></div>
        </aside>
      </section>

      <section className="lower-grid">
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Profil de jeu</span><h2>Forces & axes de travail</h2></div><span className="updated">Mis à jour aujourd’hui</span></div>
          {(Object.entries(profile.skillRatings) as Array<[SkillArea, number]>).map(([area, rating]) => (
            <SkillMeter key={area} label={skillLabels[area]} value={rating} tone={area === topSignal?.area ? "focus" : profile.strengths.some((strength) => strength.toLowerCase().includes(skillLabels[area].toLowerCase())) ? "strong" : "normal"} />
          ))}
          <div className="strength-note"><span>Point fort</span><p>{profile.strengths[0] ?? "Pas encore assez de données pour identifier un point fort stable."}</p></div>
        </article>
        <article className="panel goal-card">
          <span className="eyebrow">Objectif blitz</span>
          <div className="rating-line"><strong>{profile.blitzRating}</strong><span>→</span><b>{profile.targetRating}</b></div>
          <div className="goal-meter"><span style={{ width: `${goalProgress}%` }} /></div>
          <p><strong>{ratingGap} points</strong> pour atteindre votre objectif.</p>
          <div className="week-dots">
            {Array.from({ length: 7 }, (_, index) => {
              const date = new Date();
              date.setDate(date.getDate() - (6 - index));
              const dateKey = date.toISOString().slice(0, 10);
              return <span key={dateKey} className={`${completedDays.has(dateKey) ? "hit" : ""} ${dateKey === todayIso ? "today" : ""}`}>{date.toLocaleDateString("fr-FR", { weekday: "narrow" })}</span>;
            })}
          </div>
        </article>
      </section>
    </div>
  );
}

function TrainingView({
  plan,
  program,
  history,
  selectedStepId,
  onSelectStep,
  onSelectSession,
  onComplete,
  onGameComplete,
  exercises,
  availableGameCount,
  analyzedGameCount,
  onAttemptRecorded,
}: {
  plan: TrainingPlan;
  program: TrainingProgram;
  history: TrainingPlan[];
  selectedStepId: string;
  onSelectStep: (stepId: string) => void;
  onSelectSession: (plan: TrainingPlan) => void;
  onComplete: (stepId: string) => Promise<void>;
  onGameComplete: (game: BotGameSummary) => Promise<void>;
  exercises: Exercise[];
  availableGameCount: number;
  analyzedGameCount: number;
  onAttemptRecorded: (correct: boolean, exercise: Exercise) => Promise<void>;
}) {
  const [feedback, setFeedback] = useState<{ message: string; stage: number; reveal: boolean; move?: string } | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [exerciseCycle, setExerciseCycle] = useState(0);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const attemptStartedAt = useRef(0);
  const selectedStep = plan.steps.find((step) => step.id === selectedStepId) ?? plan.steps[0];
  const completed = plan.steps.filter((step) => step.completed).length;
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const stepExercises = (selectedStep.exerciseIds ?? [])
    .map((id) => exerciseById.get(id))
    .filter((exercise): exercise is Exercise => Boolean(exercise));
  const exercise = stepExercises[exerciseIndex];

  useEffect(() => {
    attemptStartedAt.current = Date.now();
  }, [exercise?.id]);

  const handleResult = async (correct: boolean, move: string) => {
    if (!exercise) return;
    const nextFailure = correct ? failedAttempts : failedAttempts + 1;
    if (correct) {
      setFeedback({ message: "Exact. Le candidat répond au problème immédiat de la position.", stage: 0, reveal: false, move });
    } else if (nextFailure === 1) {
      setFeedback({
        message: `Votre coup ${move} est légal, mais ne résout pas le problème principal. Revenez à la position et contrôlez la meilleure réponse adverse.`,
        stage: 1,
        reveal: false,
        move,
      });
    } else if (nextFailure === 2) {
      setFeedback({
        message: narrator.explain(exercise.area, { move, evaluationLoss: exercise.centipawnLoss }),
        stage: 2,
        reveal: false,
        move,
      });
    } else {
      setFeedback({
        message: `${exercise.explanation} Principe à retenir : ${narrator.explain(exercise.area, { move, evaluationLoss: exercise.centipawnLoss })}`,
        stage: 3,
        reveal: true,
        move,
      });
    }
    setFailedAttempts(nextFailure);
    await queueAttempt({
      id: createLocalId("attempt"),
      exerciseId: exercise.id,
      move,
      correct,
      responseMs: elapsedSince(attemptStartedAt.current),
      createdAt: new Date().toISOString(),
      synced: false,
    });
    await onAttemptRecorded(correct, {
      ...exercise,
      intervalDays: correct ? Math.min(30, Math.max(1, exercise.intervalDays * 2)) : 1,
      dueAt: nextReviewDate(new Date(), exercise.intervalDays, correct).toISOString(),
    });
  };

  const retryExercise = () => {
    setFeedback(null);
    setExerciseCycle((cycle) => cycle + 1);
    attemptStartedAt.current = Date.now();
  };

  const continueExercise = async () => {
    if (exerciseIndex < stepExercises.length - 1) {
      setExerciseIndex((index) => index + 1);
      setFeedback(null);
      setFailedAttempts(0);
      setExerciseCycle((cycle) => cycle + 1);
      return;
    }
    await onComplete(selectedStep.id);
  };

  const stepContent = () => {
    if (selectedStep.kind === "exercise" || selectedStep.kind === "replay" || (selectedStep.kind === "review" && plan.sessionKind !== "match")) {
      if (!exercise) {
        return (
          <article className="panel step-action">
            <span className="eyebrow">Données insuffisantes</span>
            <h2>Aucune position disponible</h2>
            <p>Cette étape restera non terminée jusqu’à la prochaine synchronisation ou partie analysée.</p>
          </article>
        );
      }
      return (
        <>
          {stepExercises.length > 1 && (
            <div className="exercise-sequence">
              <strong>Position {exerciseIndex + 1}/{stepExercises.length}</strong>
              <span>{exercise.title}</span>
            </div>
          )}
          <ChessBoardPanel
            key={`${exercise.id}-${exerciseCycle}`}
            mode="exercise"
            fen={exercise.fen}
            expectedMove={exercise.expectedMoves[0]}
            onExerciseResult={handleResult}
            coachArrows={feedback?.reveal
              ? [{ startSquare: exercise.expectedMoves[0].slice(0, 2), endSquare: exercise.expectedMoves[0].slice(2, 4), color: "rgba(73, 151, 82, .9)" }]
              : feedback?.stage === 1 && feedback.move
                ? [{ startSquare: feedback.move.slice(0, 2), endSquare: feedback.move.slice(2, 4), color: "rgba(190, 76, 65, .86)" }]
                : []}
          />
        </>
      );
    }
    if (selectedStep.kind === "mini-game") {
      return (
        <>
          <p className="lead">Jouez une partie courte contre Stockfish Lite. La pendule et la force sont réglables sous l’échiquier.</p>
          <ChessBoardPanel key={selectedStep.startFen ?? "standard"} fen={selectedStep.startFen} onGameComplete={(game) => {
            void onGameComplete(game).then(() => onComplete(selectedStep.id));
          }} />
        </>
      );
    }
    return (
      <article className="panel step-action">
        <span className="eyebrow">{plan.sessionKind === "match" ? "Mission Chess.com" : "Consigne du coach"}</span>
        <h2>{selectedStep.title}</h2>
        <p>{selectedStep.kind === "review"
          ? plan.playMission ?? "Revoyez la position et formulez deux candidats avant de consulter la solution."
          : "Notez en une phrase ce qui a fonctionné et le point à surveiller lors de la prochaine séance."}</p>
        {plan.sessionKind === "match" && (
          <a className="secondary-button" href="https://www.chess.com/play/online" target="_blank" rel="noreferrer">
            Jouer sur Chess.com
          </a>
        )}
        <button className="primary-button" type="button" onClick={() => onComplete(selectedStep.id)}>
          {selectedStep.completed ? "Étape terminée ✓" : "Marquer comme terminé"}
        </button>
      </article>
    );
  };

  return (
    <div className="view-stack">
      <div className="training-layout">
        <div className="training-main">
          <div className="training-intro">
            <span className="eyebrow">Étape {plan.steps.indexOf(selectedStep) + 1} sur {plan.steps.length} · {plan.focus}</span>
            <h1>{selectedStep.title}</h1>
            <p className="lead">{selectedStep.kind === "exercise" || selectedStep.kind === "replay" || (selectedStep.kind === "review" && plan.sessionKind !== "match")
              ? "Trouvez le meilleur candidat sans moteur. Le coach donnera un retour progressif après votre coup."
              : plan.rationale}</p>
          </div>
          <nav className="mobile-session-progress" aria-label="Étapes de la séance">
            {plan.steps.map((step, index) => (
              <button key={step.id} className={`${step.id === selectedStep.id ? "active" : ""} ${step.completed ? "done" : ""}`} type="button" onClick={() => onSelectStep(step.id)}>
                <span>{step.completed ? "✓" : index + 1}</span>
                <small>{step.minutes} min</small>
              </button>
            ))}
          </nav>
          {stepContent()}
        </div>
        <aside className="panel exercise-coach">
          <div className="coach-avatar">♞</div>
          <h2 className="session-summary-title">Votre séance complète</h2>
          <p className="session-summary-copy">{completed}/{plan.steps.length} étapes réellement terminées.</p>
          {feedback && (
            <div className="feedback" role="status">
              <strong>{feedback.stage === 1 ? "À vous de rejouer" : feedback.stage === 2 ? "Indice du coach" : feedback.reveal ? "Solution expliquée" : "Bien joué"}</strong>
              <p>{feedback.message}</p>
              {feedback.reveal && exercise && (
                <div className="move-comparison">
                  <span>Votre coup <strong>{feedback.move ?? exercise.comparisonMove ?? "—"}</strong></span>
                  <span>Meilleur coup <strong>{exercise.expectedMoves[0]}</strong></span>
                </div>
              )}
              {feedback.stage > 0 && !feedback.reveal && (
                <button className="secondary-button" type="button" onClick={retryExercise}>Réessayer la position</button>
              )}
              {(feedback.reveal || feedback.stage === 0) && (
                <button className="primary-button" type="button" onClick={continueExercise}>
                  {exerciseIndex < stepExercises.length - 1 ? "Exercice suivant →" : "Terminer l’étape"}
                </button>
              )}
            </div>
          )}
          {exercise && (
            <CoachLivePanel
              fen={exercise.fen}
              stepTitle={selectedStep.title}
              playedMove={feedback?.move}
              bestMove={feedback?.reveal ? exercise.expectedMoves[0] : undefined}
              evaluationLoss={exercise.centipawnLoss}
              explanation={exercise.explanation}
              automaticQuestion={feedback && feedback.stage > 0
                ? "Je viens de me tromper. Explique mon erreur sans me donner immédiatement la solution."
                : undefined}
              automaticKey={feedback && feedback.stage > 0 ? `${exercise.id}-${failedAttempts}` : undefined}
              floatingOnMobile
            />
          )}
          <div className="compact-steps">
            {plan.steps.map((step, index) => (
              <button key={step.id} className={`${step.id === selectedStep.id ? "active" : ""} ${step.completed ? "done" : ""}`} type="button" onClick={() => onSelectStep(step.id)}>
                <span>{step.completed ? "✓" : index + 1}</span>
                <strong>{step.title}</strong>
                <small>{step.minutes} min</small>
              </button>
            ))}
          </div>
        </aside>
      </div>

      <section className="panel program-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">{availableGameCount} parties importées · {analyzedGameCount} analysées</span><h2>Programme des 14 jours</h2></div>
          <span className="duration-pill">{program.startDate} → {program.endDate}</span>
        </div>
        <small className="carousel-hint">Faites glisser pour parcourir les 14 jours</small>
        <div className="program-grid" role="region" aria-label="Programme d’entraînement sur 14 jours">
          {program.sessions.map((session, index) => {
            const preparedSession = preparePlan(session, exercises);
            const saved = history.find((item) => item.id === session.id);
            const displayedSession = saved ?? (session.id === plan.id ? plan : preparedSession);
            const done = displayedSession.steps.filter((step) => step.completed).length;
            return (
              <button key={session.id} type="button" className={`${session.id === plan.id ? "active" : ""} ${done === displayedSession.steps.length ? "done" : ""}`} onClick={() => onSelectSession(preparedSession)}>
                <span>Jour {index + 1}</span>
                <strong>{session.sessionKind === "match" ? "Partie réelle" : session.headline}</strong>
                <small>{new Date(`${session.date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · {done}/{displayedSession.steps.length}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel history-panel">
        <div className="panel-heading"><div><span className="eyebrow">IndexedDB local</span><h2>Historique des séances commencées</h2></div></div>
        {history.length === 0
          ? <p>Aucune séance terminée pour le moment. Votre progression commence à 0.</p>
          : history.map((session) => (
            <button key={session.id} type="button" onClick={() => onSelectSession(session)}>
              <span>{new Date(`${session.date}T12:00:00`).toLocaleDateString("fr-FR")}</span>
              <strong>{session.headline}</strong>
              <small>{session.steps.filter((step) => step.completed).length}/{session.steps.length} étapes</small>
            </button>
          ))}
      </section>
    </div>
  );
}

function PlayView({ focus, onGameComplete }: { focus: SkillArea; onGameComplete: (game: BotGameSummary) => Promise<void> }) {
  const [positionInput, setPositionInput] = useState("");
  const [startingFen, setStartingFen] = useState<string>();
  const [currentFen, setCurrentFen] = useState(new Chess().fen());
  const [positionError, setPositionError] = useState("");
  const [boardCycle, setBoardCycle] = useState(0);

  const startFromPosition = () => {
    const value = positionInput.trim();
    if (!value) {
      setStartingFen(undefined);
      setCurrentFen(new Chess().fen());
      setBoardCycle((cycle) => cycle + 1);
      setPositionError("");
      return;
    }
    try {
      const game = new Chess(value);
      setStartingFen(game.fen());
      setCurrentFen(game.fen());
      setBoardCycle((cycle) => cycle + 1);
      setPositionError("");
      return;
    } catch {
      // The input may be PGN or a simple SAN move sequence.
    }
    try {
      const game = new Chess();
      try {
        game.loadPgn(value);
      } catch {
        const tokens = value
          .replace(/\d+\.(\.\.)?/g, " ")
          .split(/\s+/)
          .filter((token) => token && !["1-0", "0-1", "1/2-1/2", "*"].includes(token));
        tokens.forEach((move) => game.move(move));
      }
      if (game.history().length === 0) throw new Error("empty");
      setStartingFen(game.fen());
      setCurrentFen(game.fen());
      setBoardCycle((cycle) => cycle + 1);
      setPositionError("");
    } catch {
      setPositionError("Position invalide. Collez une FEN ou une suite de coups PGN/SAN.");
    }
  };

  return (
    <div className="play-layout">
      <div className="play-main">
        <div className="play-intro">
          <span className="eyebrow">Partie d’entraînement</span>
          <h1>Jouez contre votre coach</h1>
          <p className="lead">Démarrez normalement ou depuis n’importe quelle position légale.</p>
          <div className="position-launcher">
            <input
              value={positionInput}
              onChange={(event) => setPositionInput(event.target.value)}
              placeholder="FEN ou coups : 1. e4 e5 2. Cf3…"
            />
            <button type="button" onClick={startFromPosition}>Créer la partie</button>
          </div>
          {positionError && <p className="position-error">{positionError}</p>}
        </div>
        <ChessBoardPanel
          key={`${startingFen ?? "standard"}-${boardCycle}`}
          fen={startingFen}
          onPositionChange={setCurrentFen}
          onGameComplete={(game) => { void onGameComplete(game); }}
        />
      </div>
      <aside className="panel play-coach">
        <CoachLivePanel fen={currentFen} stepTitle="Partie contre Stockfish Lite" />
        <div className="contract-item"><span>Focus</span><strong>{skillLabels[focus]}</strong></div>
        <div className="contract-item"><span>Après-partie</span><strong>Exercice automatique</strong></div>
      </aside>
    </div>
  );
}

function GamesView({
  profile,
  onGamesChange,
  onProfileChange,
}: {
  profile: PlayerProfile;
  onGamesChange: (games: Game[]) => void;
  onProfileChange: (profile: CloudProfile) => void;
}) {
  const [games, setGames] = useState<Game[]>([]);
  const [visibleCount, setVisibleCount] = useState(12);
  const [syncing, setSyncing] = useState(false);
  const [username, setUsername] = useState(profile.chessComUsername);
  const [message, setMessage] = useState("Chargement de votre historique réel…");
  useEffect(() => {
    listCachedGames().then((items) => {
      setGames(items);
      onGamesChange(items);
      setMessage(`${items.length} parties importées · ${items.filter((game) => game.analyzed).length} réellement analysées`);
    }).catch(() => undefined);
  }, [onGamesChange]);
  const sync = async () => {
    setSyncing(true);
    setMessage("Import incrémental depuis Chess.com…");
    try {
      const response = await fetch("/api/chesscom/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, limit: 300 }) });
      if (!response.ok) throw new Error("sync");
      const data = await response.json() as {
        games: Game[];
        imported: number;
        cloudPersisted: boolean;
        profile?: CloudProfile;
      };
      await cacheGames(data.games);
      if (data.profile) onProfileChange(data.profile);
      let items = await listCachedGames();
      let cloudPersisted = data.cloudPersisted;
      try {
        const cloudState = await syncCloudState();
        items = cloudState.games;
        cloudPersisted = true;
        if (cloudState.profile) onProfileChange(cloudState.profile);
      } catch {
        cloudPersisted = false;
      }
      setGames(items);
      onGamesChange(items);
      setMessage(`${items.length} parties importées · ${items.filter((game) => game.analyzed).length} réellement analysées · ${cloudPersisted ? "enregistrées dans le cloud" : "enregistrées sur cet appareil seulement"}`);
    } catch {
      setMessage("Hors ligne : vos parties en cache restent accessibles.");
    } finally {
      setSyncing(false);
    }
  };
  const importPgn = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const pgn = await file.text();
      const chess = new Chess();
      chess.loadPgn(pgn);
      const headers = chess.getHeaders();
      const playerIsWhite = (headers.White ?? "").toLowerCase() === profile.chessComUsername;
      const resultHeader = headers.Result ?? "*";
      const result: Game["result"] = resultHeader === "1/2-1/2" ? "draw" : (resultHeader === "1-0") === playerIsWhite ? "win" : "loss";
      const sourceId = createLocalId("pgn");
      const game: Game = { id: `pgn-${sourceId}`, source: "pgn", sourceId, playedAt: new Date().toISOString(), timeClass: "other", playerColor: playerIsWhite ? "white" : "black", result, white: headers.White ?? "Blancs", black: headers.Black ?? "Noirs", pgn, analyzed: false };
      setGames((current) => [game, ...current]);
      await cacheGames([game]);
      onGamesChange(await listCachedGames());
      setMessage("PGN importé et placé dans la file d’analyse.");
    } catch {
      setMessage("Ce fichier PGN n’est pas valide.");
    } finally {
      event.target.value = "";
    }
  };
  return (
    <div className="view-stack">
      <section className="page-title"><div><span className="eyebrow">Bibliothèque personnelle</span><h1>Vos parties</h1><p>{message}</p></div><div className="page-actions"><input aria-label="Pseudo Chess.com" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Pseudo Chess.com" /><label className="secondary-button">Importer un PGN<input type="file" accept=".pgn,application/x-chess-pgn" onChange={importPgn} hidden /></label><button className="primary-button" type="button" onClick={sync} disabled={syncing || username.trim().length < 2}>{syncing ? "Synchronisation…" : "Synchroniser Chess.com"}</button></div></section>
      <section className="panel games-table">
        <div className="table-head"><span>Partie</span><span>Cadence</span><span>Résultat</span><span>Analyse</span></div>
        {games.length === 0 && <p className="empty-state">Aucune partie enregistrée. Jouez contre Stockfish ou synchronisez Chess.com.</p>}
        {games.slice(0, visibleCount).map((game) => (

          <div className="table-row" key={game.id}><span><strong>{game.white} – {game.black}</strong><small>{new Date(game.playedAt).toLocaleDateString("fr-FR")} · {game.source === "chesscoach" ? "ChessCoach" : game.source === "pgn" ? "PGN" : "Chess.com"}</small></span><span>{game.timeClass}</span><span className={`result ${game.result}`}>{game.result === "win" ? "Victoire" : game.result === "loss" ? "Défaite" : "Nulle"}</span><span>{game.analyzed ? "✓ Prête" : game.source === "chesscoach" ? "À analyser" : "En attente"}</span></div>
        ))}
        {games.length > 0 && (
          <div className="games-pagination">
            <span>{Math.min(visibleCount, games.length)} affichées sur {games.length}</span>
            {visibleCount < games.length && (
              <button type="button" onClick={() => setVisibleCount((count) => Math.min(games.length, count + 24))}>
                Afficher 24 parties de plus
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ProgressView({ profile, attempts, games, signals }: { profile: PlayerProfile; attempts: Attempt[]; games: Game[]; signals: WeaknessSignal[] }) {
  const firstAttempts = new Map<string, Attempt>();
  [...attempts].sort((left, right) => left.createdAt.localeCompare(right.createdAt)).forEach((attempt) => {
    if (!firstAttempts.has(attempt.exerciseId)) firstAttempts.set(attempt.exerciseId, attempt);
  });
  const firstTryRate = firstAttempts.size
    ? Math.round([...firstAttempts.values()].filter((attempt) => attempt.correct).length / firstAttempts.size * 100)
    : null;
  const solvedRate = attempts.length ? Math.round(attempts.filter((attempt) => attempt.correct).length / attempts.length * 100) : null;
  const botGames = games.filter((game) => game.source === "chesscoach");
  const analyzedGames = games.filter((game) => game.analyzed).length;
  const topSignal = signals[0];
  return (
    <div className="view-stack">
      <section className="page-title"><div><span className="eyebrow">Progression réelle</span><h1>Ce que vos données montrent</h1><p>Aucune statistique n’est simulée : les valeurs viennent de vos parties et tentatives.</p></div><div className="rating-badge"><strong>{profile.blitzRating}</strong><span>Blitz Chess.com</span></div></section>
      <section className="progress-grid">
        <article className="panel"><span className="eyebrow">Volume observé</span><h2>Base d’apprentissage</h2><div className="metric"><strong>{games.length}</strong><span>parties synchronisées</span></div><div className="metric"><strong>{botGames.length}</strong><span>parties jouées contre ChessCoach</span></div><div className="metric"><strong>{analyzedGames}</strong><span>parties avec analyse disponible</span></div></article>
        <article className="panel"><span className="eyebrow">Exercices</span><h2>Résultats enregistrés</h2><div className="metric"><strong>{firstTryRate === null ? "—" : `${firstTryRate} %`}</strong><span>réussis au premier essai</span></div><div className="metric"><strong>{solvedRate === null ? "—" : `${solvedRate} %`}</strong><span>de tentatives correctes</span></div><div className="metric"><strong>{attempts.length}</strong><span>tentatives enregistrées</span></div></article>
      </section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Compétences calculées</span><h2>Trajectoire vers {profile.targetRating}</h2></div></div>{(Object.entries(profile.skillRatings) as Array<[SkillArea, number]>).map(([area, rating]) => <SkillMeter key={area} label={skillLabels[area]} value={rating} tone={area === topSignal?.area ? "focus" : "normal"} />)}</section>
    </div>
  );
}

export function ChessCoachApp() {
  const [tab, setTab] = useState<Tab>("today");
  const online = useSyncExternalStore(subscribeNetwork, () => navigator.onLine, () => true);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [storedProfile, setStoredProfile] = useState<PlayerProfile>(emptyProfile);
  const [activePlan, setActivePlan] = useState<TrainingPlan>(initialPlan);
  const [selectedStepId, setSelectedStepId] = useState(initialPlan.steps[0]?.id ?? "");
  const [sessionHistory, setSessionHistory] = useState<TrainingPlan[]>([]);
  const [exerciseLibrary, setExerciseLibrary] = useState<Exercise[]>([]);
  const [attemptHistory, setAttemptHistory] = useState<Attempt[]>([]);
  const [cachedGames, setCachedGames] = useState<Game[]>([]);
  const [cloudSynced, setCloudSynced] = useState(false);
  const runtimeSignals = useMemo(
    () => deriveWeaknessSignals(cachedGames, attemptHistory, exerciseLibrary),
    [attemptHistory, cachedGames, exerciseLibrary],
  );
  const profile = useMemo(
    () => deriveProfile(storedProfile, cachedGames, runtimeSignals),
    [cachedGames, runtimeSignals, storedProfile],
  );
  const trainingProgram = useMemo(
    () => buildTrainingProgram(
      profile,
      runtimeSignals,
      exerciseLibrary,
      cachedGames.filter((game) => game.analyzed).length,
      new Date(),
      sessionHistory,
    ),
    [cachedGames, exerciseLibrary, profile, runtimeSignals, sessionHistory],
  );

  useEffect(() => {
    void cacheProfile(profile);
  }, [profile]);

  useEffect(() => {
    const todayPlan = trainingProgram.sessions.find((plan) => plan.date === todayIso) ?? trainingProgram.sessions[0];
    if (!todayPlan) return;
    Promise.resolve().then(() => {
      setActivePlan((current) => current.id === todayPlan.id ? current : todayPlan);
      setSelectedStepId((current) => current || (todayPlan.steps.find((step) => !step.completed)?.id ?? todayPlan.steps[0]?.id ?? ""));
    });
  }, [trainingProgram]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listTrainingPlans(),
      listCachedExercises(),
      listAttempts(),
      listCachedGames(),
      loadCachedProfile(),
    ]).then(async ([plans, exercises, attempts, games, savedProfile]) => {
      if (cancelled) return;
      const merged = distinctExercises(exercises);
      const signals = deriveWeaknessSignals(games, attempts, merged);
      const dynamicProfile = deriveProfile(savedProfile ?? emptyProfile, games, signals);
      const program = buildTrainingProgram(dynamicProfile, signals, merged, games.filter((game) => game.analyzed).length, new Date(), plans);
      const normalizedPlans = program.sessions;
      await Promise.all(normalizedPlans.map((plan) => saveTrainingPlan(plan)));
      await cacheProfile(dynamicProfile);
      setExerciseLibrary(merged);
      setSessionHistory(normalizedPlans);
      setAttemptHistory(attempts);
      setCachedGames(games);
      setStoredProfile(dynamicProfile);
      const todayPlan = program.sessions.find((plan) => plan.date === todayIso) ?? program.sessions[0];
      setActivePlan(todayPlan);
      setSelectedStepId(todayPlan.steps.find((step) => !step.completed)?.id ?? todayPlan.steps[0]?.id ?? "");
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    syncCloudState().then(async (state) => {
      if (cancelled) return;
      setCloudSynced(true);
      setCachedGames(state.games);
      setAttemptHistory(state.attempts);
      const mergedExercises = distinctExercises(state.exercises);
      const signals = deriveWeaknessSignals(state.games, state.attempts, mergedExercises);
      const cachedProfile = await loadCachedProfile();
      const cloudProfile = state.profile ? mergeCloudProfile(cachedProfile ?? emptyProfile, state.profile) : (cachedProfile ?? emptyProfile);
      const dynamicProfile = deriveProfile(cloudProfile, state.games, signals);
      const program = buildTrainingProgram(dynamicProfile, signals, mergedExercises, state.games.filter((game) => game.analyzed).length, new Date(), state.plans);
      const normalizedPlans = program.sessions;
      await Promise.all(normalizedPlans.map((plan) => saveTrainingPlan(plan)));
      await cacheProfile(dynamicProfile);
      setSessionHistory(normalizedPlans);
      setExerciseLibrary(mergedExercises);
      setStoredProfile(dynamicProfile);
      const syncedPlan = normalizedPlans.find((plan) => plan.date === todayIso)
        ?? normalizedPlans[0];
      if (syncedPlan) {
        setActivePlan(syncedPlan);
        setSelectedStepId(syncedPlan.steps.find((step) => !step.completed)?.id ?? syncedPlan.steps[0]?.id ?? "");
      }
    }).catch(() => {
      if (!cancelled) setCloudSynced(false);
    });
    return () => { cancelled = true; };
  }, [online]);

  useEffect(() => {
    const installHandler = (event: Event) => { event.preventDefault(); setInstallPrompt(event as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", installHandler);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => {
      window.removeEventListener("beforeinstallprompt", installHandler);
    };
  }, []);

  const startSession = (stepId?: string) => {
    const nextStep = stepId
      ?? activePlan.steps.find((step) => !step.completed)?.id
      ?? activePlan.steps[0]?.id;
    if (nextStep) setSelectedStepId(nextStep);
    setTab("training");
  };

  const selectSession = (session: TrainingPlan) => {
    const prepared = preparePlan(session, exerciseLibrary);
    setActivePlan(prepared);
    setSelectedStepId(prepared.steps.find((step) => !step.completed)?.id ?? prepared.steps[0]?.id ?? "");
    setTab("training");
  };

  const completeStep = async (stepId: string) => {
    const nextPlan = {
      ...activePlan,
      steps: activePlan.steps.map((step) => step.id === stepId ? { ...step, completed: true } : step),
    };
    setActivePlan(nextPlan);
    await saveTrainingPlan(nextPlan);
    setSessionHistory(await listTrainingPlans());
    if (online) syncCloudState().then(() => setCloudSynced(true)).catch(() => setCloudSynced(false));
    const nextStep = nextPlan.steps.find((step) => !step.completed);
    if (nextStep) setSelectedStepId(nextStep.id);
  };

  const recordBotGame = async (summary: BotGameSummary) => {
    const sourceId = createLocalId("bot");
    const game: Game = {
      id: `chesscoach-${sourceId}`,
      source: "chesscoach",
      sourceId,
      playedAt: summary.playedAt,
      timeClass: summary.timeClass,
      playerColor: summary.playerColor,
      result: summary.result,
      white: summary.playerColor === "white" ? profile.chessComUsername : `ChessCoach · Stockfish Lite ${summary.timeControl}`,
      black: summary.playerColor === "black" ? profile.chessComUsername : `ChessCoach · Stockfish Lite ${summary.timeControl}`,
      pgn: summary.pgn,
      analyzed: summary.criticalPositions.length > 0,
      timeControl: summary.timeControl,
      criticalPositions: summary.criticalPositions,
    };
    await cacheGames([game]);
    setCachedGames(await listCachedGames());

    const critical = summary.criticalPositions[0];
    if (critical) {
      const exercise: Exercise = {
        id: `bot-exercise-${sourceId}`,
        title: "Position critique de votre partie Stockfish",
        area: critical.area,
        fen: critical.fen,
        sideToMove: critical.fen.includes(" w ") ? "white" : "black",
        expectedMoves: [critical.bestMove],
        explanation: `Vous avez joué ${critical.playedMove}. Comparez ce choix avec ${critical.bestMove}, qui limite la meilleure réponse adverse.`,
        source: "personal",
        dueAt: new Date().toISOString(),
        intervalDays: 1,
        centipawnLoss: critical.centipawnLoss,
        originGameId: game.id,
        comparisonMove: critical.playedMove,
      };
      await cacheExercises([exercise]);
      setExerciseLibrary((current) => distinctExercises([exercise, ...current]));
      const adaptedPlan: TrainingPlan = {
        ...activePlan,
        focus: critical.area,
        rationale: `Votre dernière partie Stockfish a révélé une position à ${critical.centipawnLoss} centipions de perte.`,
        steps: activePlan.steps.map((step) => {
          if (step.kind === "replay") return { ...step, exerciseIds: [exercise.id], completed: false };
          if (step.kind === "mini-game") return { ...step, startFen: exercise.fen, completed: false };
          return step;
        }),
      };
      setActivePlan(adaptedPlan);
      await saveTrainingPlan(adaptedPlan);
      setSessionHistory(await listTrainingPlans());
    }
    if (online) syncCloudState().then(() => setCloudSynced(true)).catch(() => setCloudSynced(false));
  };

  const title = useMemo(() => navigation.find((item) => item.id === tab)?.label, [tab]);
  const remainingSteps = activePlan.steps.filter((step) => !step.completed).length;
  const completedSessionDates = new Set(sessionHistory.filter((session) => session.steps.every((step) => step.completed)).map((session) => session.date));
  let streak = 0;
  const streakCursor = new Date();
  while (completedSessionDates.has(streakCursor.toISOString().slice(0, 10))) {
    streak += 1;
    streakCursor.setDate(streakCursor.getDate() - 1);
  }
  const ratingGap = Math.max(0, profile.targetRating - profile.blitzRating);
  const goalProgress = Math.min(100, Math.round(profile.blitzRating / profile.targetRating * 100));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#today" onClick={() => setTab("today")}><span>♞</span><div><strong>ChessCoach</strong><small>Votre jeu. Votre plan.</small></div></a>
        <nav aria-label="Navigation principale">{navigation.map((item) => <button key={item.id} type="button" className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span>{item.icon}</span>{item.label}{item.id === "today" && remainingSteps > 0 && <i>{remainingSteps}</i>}</button>)}</nav>
        <div className="sidebar-goal"><span>Objectif blitz</span><div><strong>{profile.blitzRating}</strong><b>/ {profile.targetRating}</b></div><div className="goal-meter"><span style={{ width: `${goalProgress}%` }} /></div><small>{ratingGap} points à gagner</small></div>
        <div className="sidebar-profile"><span>{profile.displayName.slice(0, 2).toUpperCase()}</span><div><strong>{profile.displayName}</strong><small>@{profile.chessComUsername}</small></div><button aria-label="Réglages">···</button></div>
      </aside>

      <main>
        <header className="topbar">
          <div><span className="mobile-knight">♞</span><p>{title}</p></div>
          <div className="top-actions"><span className={`connection ${online ? "" : "offline"}`}>{online ? cloudSynced ? "Cloud synchronisé" : "Synchronisation…" : "Mode hors ligne"}</span>{installPrompt && <button className="install-button" type="button" onClick={() => installPrompt.prompt()}>Installer l’app</button>}{streak > 0 && <div className="streak"><span>♨</span><strong>{streak}</strong><small>jours</small></div>}<span className="avatar">{profile.displayName.slice(0, 2).toUpperCase()}</span></div>
        </header>
        <div className="content">
          {tab === "today" && <TodayView plan={activePlan} profile={profile} signals={runtimeSignals} analyzedGames={cachedGames.filter((game) => game.analyzed).length} history={sessionHistory} onStart={startSession} />}
          {tab === "play" && <PlayView focus={activePlan.focus} onGameComplete={recordBotGame} />}
          {tab === "training" && (
            <TrainingView
              key={`${activePlan.id}-${selectedStepId}`}
              plan={activePlan}
              program={trainingProgram}
              history={sessionHistory}
              selectedStepId={selectedStepId}
              onSelectStep={setSelectedStepId}
              onSelectSession={selectSession}
              onComplete={completeStep}
              onGameComplete={recordBotGame}
              exercises={exerciseLibrary}
              availableGameCount={cachedGames.length}
              analyzedGameCount={cachedGames.filter((game) => game.analyzed).length}
              onAttemptRecorded={async (correct, updatedExercise) => {
                await cacheExercises([updatedExercise]);
                setExerciseLibrary((current) => current.map((exercise) => exercise.id === updatedExercise.id ? updatedExercise : exercise));
                setAttemptHistory(await listAttempts());
              }}
            />
          )}
          {tab === "games" && <GamesView key={profile.chessComUsername} profile={profile} onGamesChange={setCachedGames} onProfileChange={(persisted) => setStoredProfile((current) => {
            const next = mergeCloudProfile(current, persisted);
            void cacheProfile(next);
            return next;
          })} />}
          {tab === "progress" && <ProgressView profile={profile} attempts={attemptHistory} games={cachedGames} signals={runtimeSignals} />}
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Navigation mobile">{navigation.map((item) => <button key={item.id} type="button" className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span>{item.icon}</span><small>{item.label === "Entraînement" ? "Entraîner" : item.label}</small></button>)}</nav>
    </div>
  );
}

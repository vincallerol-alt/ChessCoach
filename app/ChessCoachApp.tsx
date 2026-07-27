"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Chess } from "chess.js";
import { AdaptiveCoachPlanner, defaultSignals, DeterministicCoachNarrator } from "../lib/coach";
import { createLocalId } from "../lib/ids";
import { cacheGames, listCachedGames, listTrainingPlans, loadTrainingPlan, queueAttempt, saveTrainingPlan, syncPendingAttempts } from "../lib/offline-db";
import type { BotGameSummary, Exercise, Game, PlayerProfile, TrainingPlan, TrainingProgram, WeaknessSignal } from "../lib/types";
import coachSnapshot from "../data/coach-snapshot.json";
import { ChessBoardPanel } from "./components/ChessBoardPanel";

type Tab = "today" | "play" | "training" | "games" | "progress";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const profile = coachSnapshot.profile as PlayerProfile;
const weeklySignals = coachSnapshot.signals as WeaknessSignal[];
const fallbackPlan = new AdaptiveCoachPlanner().buildDailyPlan(
  profile,
  weeklySignals.length ? weeklySignals : defaultSignals,
  new Date(),
);
const trainingProgram = coachSnapshot.program as TrainingProgram;
const todayIso = new Date().toISOString().slice(0, 10);
const initialPlan = trainingProgram.sessions.find((session) => session.date === todayIso)
  ?? trainingProgram.sessions[0]
  ?? fallbackPlan;
const primaryExercise = coachSnapshot.exercises[0] as Exercise;
const demoGames = [
  { id: "demo-1", white: "vincentito", black: "opponent_1420", playedAt: "2026-07-27T12:00:00.000Z", timeClass: "blitz", result: "win", analyzed: true },
  { id: "demo-2", white: "opponent_1391", black: "vincentito", playedAt: "2026-07-26T12:00:00.000Z", timeClass: "blitz", result: "loss", analyzed: true },
  { id: "demo-3", white: "vincentito", black: "opponent_1510", playedAt: "2026-07-25T12:00:00.000Z", timeClass: "rapid", result: "draw", analyzed: false },
] as const;
const narrator = new DeterministicCoachNarrator();

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

function TodayView({ plan, onStart }: { plan: TrainingPlan; onStart: (stepId?: string) => void }) {
  const completed = plan.steps.filter((step) => step.completed).length;
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
          <div className="panel-heading"><div><span className="eyebrow">Programme adaptatif</span><h2>Votre parcours aujourd’hui</h2></div><span className="duration-pill">20 min</span></div>
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
          <h2>Commencez par la position, pas par les coups.</h2>
          <p>{narrator.explain("strategy", {})}</p>
          <div className="quote-source"><span>Observation récurrente</span><strong>17 parties récentes</strong></div>
        </aside>
      </section>

      <section className="lower-grid">
        <article className="panel">
          <div className="panel-heading"><div><span className="eyebrow">Profil de jeu</span><h2>Forces & axes de travail</h2></div><span className="updated">Mis à jour aujourd’hui</span></div>
          <SkillMeter label="Finales" value={1400} tone="strong" />
          <SkillMeter label="Tactique" value={1350} />
          <SkillMeter label="Ouvertures" value={1300} />
          <SkillMeter label="Stratégie" value={1250} tone="focus" />
          <div className="strength-note"><span>Point fort</span><p>Scandinave avec les Noirs · 69 % de victoires sur l’échantillon récent.</p></div>
        </article>
        <article className="panel goal-card">
          <span className="eyebrow">Objectif blitz</span>
          <div className="rating-line"><strong>{profile.blitzRating}</strong><span>→</span><b>{profile.targetRating}</b></div>
          <div className="goal-meter"><span style={{ width: "58%" }} /></div>
          <p><strong>+127 points</strong> pour retrouver puis stabiliser votre meilleur niveau.</p>
          <div className="week-dots"><span>L</span><span className="hit">M</span><span className="hit">M</span><span className="today">J</span><span>V</span><span>S</span><span>D</span></div>
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
}: {
  plan: TrainingPlan;
  program: TrainingProgram;
  history: TrainingPlan[];
  selectedStepId: string;
  onSelectStep: (stepId: string) => void;
  onSelectSession: (plan: TrainingPlan) => void;
  onComplete: (stepId: string) => Promise<void>;
  onGameComplete: (game: BotGameSummary) => Promise<void>;
}) {
  const [feedback, setFeedback] = useState<{ message: string; stage: number; reveal: boolean } | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [exerciseCycle, setExerciseCycle] = useState(0);
  const attemptStartedAt = useRef(0);
  const selectedStep = plan.steps.find((step) => step.id === selectedStepId) ?? plan.steps[0];
  const completed = plan.steps.filter((step) => step.completed).length;

  useEffect(() => {
    attemptStartedAt.current = Date.now();
  }, []);

  const handleResult = async (correct: boolean, move: string) => {
    const nextFailure = correct ? failedAttempts : failedAttempts + 1;
    if (correct) {
      setFeedback({ message: "Exact. Le candidat répond au problème immédiat de la position.", stage: 0, reveal: false });
    } else if (nextFailure === 1) {
      setFeedback({
        message: `Votre coup ${move} est légal, mais ne résout pas le problème principal. Revenez à la position et contrôlez la meilleure réponse adverse.`,
        stage: 1,
        reveal: false,
      });
    } else if (nextFailure === 2) {
      setFeedback({
        message: narrator.explain(primaryExercise.area, { move, evaluationLoss: primaryExercise.centipawnLoss }),
        stage: 2,
        reveal: false,
      });
    } else {
      setFeedback({
        message: `${primaryExercise.explanation} Principe à retenir : ${narrator.explain(primaryExercise.area, { move, evaluationLoss: primaryExercise.centipawnLoss })}`,
        stage: 3,
        reveal: true,
      });
    }
    setFailedAttempts(nextFailure);
    await queueAttempt({
      id: createLocalId("attempt"),
      exerciseId: primaryExercise.id,
      move,
      correct,
      responseMs: Date.now() - attemptStartedAt.current,
      createdAt: new Date().toISOString(),
      synced: false,
    });
    if (correct) await onComplete(selectedStep.id);
  };

  const retryExercise = () => {
    setFeedback(null);
    setExerciseCycle((cycle) => cycle + 1);
    attemptStartedAt.current = Date.now();
  };

  const stepContent = () => {
    if (selectedStep.kind === "exercise" || selectedStep.kind === "replay") {
      return (
        <ChessBoardPanel
          key={`${primaryExercise.id}-${exerciseCycle}`}
          mode="exercise"
          fen={primaryExercise.fen}
          expectedMove={primaryExercise.expectedMoves[0]}
          onExerciseResult={handleResult}
        />
      );
    }
    if (selectedStep.kind === "mini-game") {
      return (
        <>
          <p className="lead">Jouez une partie courte contre Stockfish Lite. La pendule et la force sont réglables sous l’échiquier.</p>
          <ChessBoardPanel onGameComplete={(game) => {
            void onGameComplete(game).then(() => onComplete(selectedStep.id));
          }} />
          <button className="primary-button complete-step" type="button" onClick={() => onComplete(selectedStep.id)}>
            Terminer la mini-partie
          </button>
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
        <div>
          <span className="eyebrow">Étape {plan.steps.indexOf(selectedStep) + 1} sur {plan.steps.length} · {plan.focus}</span>
          <h1>{selectedStep.title}</h1>
          <p className="lead">{selectedStep.kind === "exercise" || selectedStep.kind === "replay"
            ? "Trouvez le meilleur candidat sans moteur. Le coach donnera un retour progressif après votre coup."
            : plan.rationale}</p>
          {stepContent()}
        </div>
        <aside className="panel exercise-coach">
          <div className="coach-avatar">♞</div>
          <h2>Votre séance complète</h2>
          <p>{completed}/{plan.steps.length} étapes réellement terminées.</p>
          <div className="compact-steps">
            {plan.steps.map((step, index) => (
              <button key={step.id} className={`${step.id === selectedStep.id ? "active" : ""} ${step.completed ? "done" : ""}`} type="button" onClick={() => onSelectStep(step.id)}>
                <span>{step.completed ? "✓" : index + 1}</span>
                <strong>{step.title}</strong>
                <small>{step.minutes} min</small>
              </button>
            ))}
          </div>
          {feedback && (
            <div className="feedback" role="status">
              <strong>{feedback.stage === 1 ? "À vous de rejouer" : feedback.stage === 2 ? "Indice du coach" : feedback.reveal ? "Solution expliquée" : "Bien joué"}</strong>
              <p>{feedback.message}</p>
              {feedback.stage > 0 && !feedback.reveal && (
                <button className="secondary-button" type="button" onClick={retryExercise}>Réessayer la position</button>
              )}
              {feedback.reveal && (
                <button className="primary-button" type="button" onClick={() => onComplete(selectedStep.id)}>J’ai compris, continuer</button>
              )}
            </div>
          )}
        </aside>
      </div>

      <section className="panel program-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">Basé sur {program.sourceGameCount} parties</span><h2>Programme des 14 jours</h2></div>
          <span className="duration-pill">{program.startDate} → {program.endDate}</span>
        </div>
        <div className="program-grid">
          {program.sessions.map((session, index) => {
            const saved = history.find((item) => item.id === session.id);
            const done = saved?.steps.filter((step) => step.completed).length ?? (session.id === plan.id ? completed : 0);
            return (
              <button key={session.id} type="button" className={`${session.id === plan.id ? "active" : ""} ${done === session.steps.length ? "done" : ""}`} onClick={() => onSelectSession(session)}>
                <span>Jour {index + 1}</span>
                <strong>{session.sessionKind === "match" ? "Partie réelle" : session.headline}</strong>
                <small>{new Date(`${session.date}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · {done}/{session.steps.length}</small>
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

function GamesView() {
  const [games, setGames] = useState<Game[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("Analyse prioritaire : 300 dernières parties rapid/blitz");
  useEffect(() => {
    listCachedGames().then(setGames).catch(() => undefined);
  }, []);
  const sync = async () => {
    setSyncing(true);
    setMessage("Import incrémental depuis Chess.com…");
    try {
      const response = await fetch("/api/chesscom/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: profile.chessComUsername, limit: 300 }) });
      if (!response.ok) throw new Error("sync");
      const data = await response.json() as { games: Game[]; imported: number };
      await cacheGames(data.games);
      setGames(await listCachedGames());
      setMessage(`${data.imported} parties disponibles · doublons ignorés`);
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
      setMessage("PGN importé et placé dans la file d’analyse.");
    } catch {
      setMessage("Ce fichier PGN n’est pas valide.");
    } finally {
      event.target.value = "";
    }
  };
  return (
    <div className="view-stack">
      <section className="page-title"><div><span className="eyebrow">Bibliothèque personnelle</span><h1>Vos parties</h1><p>{message}</p></div><div className="page-actions"><label className="secondary-button">Importer un PGN<input type="file" accept=".pgn,application/x-chess-pgn" onChange={importPgn} hidden /></label><button className="primary-button" type="button" onClick={sync} disabled={syncing}>{syncing ? "Synchronisation…" : "Synchroniser Chess.com"}</button></div></section>
      <section className="panel games-table">
        <div className="table-head"><span>Partie</span><span>Cadence</span><span>Résultat</span><span>Analyse</span></div>
        {(games.length ? games.slice(0, 12) : demoGames).map((game) => (

          <div className="table-row" key={game.id}><span><strong>{game.white} – {game.black}</strong><small>{new Date(game.playedAt).toLocaleDateString("fr-FR")} · {game.source === "chesscoach" ? "ChessCoach" : game.source === "pgn" ? "PGN" : "Chess.com"}</small></span><span>{game.timeClass}</span><span className={`result ${game.result}`}>{game.result === "win" ? "Victoire" : game.result === "loss" ? "Défaite" : "Nulle"}</span><span>{game.analyzed ? "✓ Prête" : game.source === "chesscoach" ? "À analyser" : "En attente"}</span></div>
        ))}
      </section>
    </div>
  );
}

function ProgressView() {
  const points = [1328, 1342, 1335, 1361, 1354, 1370, 1373];
  return (
    <div className="view-stack">
      <section className="page-title"><div><span className="eyebrow">Progression</span><h1>Votre jeu devient plus stable</h1><p>Le coach mesure les compétences, pas seulement l’Elo.</p></div><div className="rating-badge"><strong>1373</strong><span>Blitz actuel</span></div></section>
      <section className="progress-grid">
        <article className="panel chart-card"><div className="panel-heading"><div><span className="eyebrow">6 dernières semaines</span><h2>Rating blitz</h2></div><strong className="positive">+45</strong></div><div className="mini-chart">{points.map((point, index) => <span key={point + index} style={{ height: `${30 + (point - 1320) * 1.1}%` }}><i>{index === points.length - 1 ? point : ""}</i></span>)}</div></article>
        <article className="panel"><span className="eyebrow">Ce qui progresse</span><h2>Décisions structurées</h2><div className="metric"><strong>71 %</strong><span>des exercices réussis au premier essai</span></div><div className="metric"><strong>−18 %</strong><span>d’erreurs graves sous 30 secondes</span></div></article>
      </section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Compétences</span><h2>Trajectoire vers 1500</h2></div></div><SkillMeter label="Finales" value={1400} tone="strong" /><SkillMeter label="Tactique" value={1350} /><SkillMeter label="Ouvertures" value={1300} /><SkillMeter label="Gestion du temps" value={1280} /><SkillMeter label="Stratégie" value={1250} tone="focus" /></section>
    </div>
  );
}

export function ChessCoachApp() {
  const [tab, setTab] = useState<Tab>("today");
  const online = useSyncExternalStore(subscribeNetwork, () => navigator.onLine, () => true);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [activePlan, setActivePlan] = useState<TrainingPlan>(initialPlan);
  const [selectedStepId, setSelectedStepId] = useState(initialPlan.steps[0]?.id ?? "");
  const [sessionHistory, setSessionHistory] = useState<TrainingPlan[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadTrainingPlan(activePlan.id).then((saved) => {
      if (!cancelled && saved) setActivePlan(saved);
    }).catch(() => undefined);
    listTrainingPlans().then((plans) => {
      if (!cancelled) setSessionHistory(plans);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [activePlan.id]);

  useEffect(() => {
    if (online) syncPendingAttempts().catch(() => undefined);
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
    setActivePlan(session);
    setSelectedStepId(session.steps.find((step) => !step.completed)?.id ?? session.steps[0]?.id ?? "");
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
      playerColor: "white",
      result: summary.result,
      white: profile.chessComUsername,
      black: `ChessCoach · Stockfish Lite ${summary.timeControl}`,
      pgn: summary.pgn,
      analyzed: false,
    };
    await cacheGames([game]);
  };

  const title = useMemo(() => navigation.find((item) => item.id === tab)?.label, [tab]);
  const remainingSteps = activePlan.steps.filter((step) => !step.completed).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#today" onClick={() => setTab("today")}><span>♞</span><div><strong>ChessCoach</strong><small>Votre jeu. Votre plan.</small></div></a>
        <nav aria-label="Navigation principale">{navigation.map((item) => <button key={item.id} type="button" className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span>{item.icon}</span>{item.label}{item.id === "today" && remainingSteps > 0 && <i>{remainingSteps}</i>}</button>)}</nav>
        <div className="sidebar-goal"><span>Objectif blitz</span><div><strong>1373</strong><b>/ 1500</b></div><div className="goal-meter"><span style={{ width: "58%" }} /></div><small>127 points à gagner</small></div>
        <div className="sidebar-profile"><span>VC</span><div><strong>Vincent</strong><small>@vincentito</small></div><button aria-label="Réglages">···</button></div>
      </aside>

      <main>
        <header className="topbar">
          <div><span className="mobile-knight">♞</span><p>{title}</p></div>
          <div className="top-actions"><span className={`connection ${online ? "" : "offline"}`}>{online ? "Synchronisé" : "Mode hors ligne"}</span>{installPrompt && <button className="install-button" type="button" onClick={() => installPrompt.prompt()}>Installer l’app</button>}<div className="streak"><span>♨</span><strong>4</strong><small>jours</small></div><span className="avatar">VC</span></div>
        </header>
        <div className="content">
          {tab === "today" && <TodayView plan={activePlan} onStart={startSession} />}
          {tab === "play" && <div className="play-layout"><div><span className="eyebrow">Partie d’entraînement</span><h1>Jouez contre votre coach</h1><p className="lead">Stockfish 18 Lite fonctionne aussi hors ligne. Chaque partie terminée ou abandonnée rejoint votre historique.</p><ChessBoardPanel onGameComplete={(game) => { void recordBotGame(game); }} /></div><aside className="panel play-coach"><div className="coach-avatar">♞</div><h2>Contrat de la partie</h2><p>Avant chaque coup calme, formulez un plan en une phrase : pire pièce, faiblesse cible, échange utile.</p><div className="contract-item"><span>Focus</span><strong>Milieu de jeu</strong></div><div className="contract-item"><span>Cadence mentale</span><strong>2 candidats</strong></div><div className="contract-item"><span>Historique</span><strong>Automatique</strong></div></aside></div>}
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
            />
          )}
          {tab === "games" && <GamesView />}
          {tab === "progress" && <ProgressView />}
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Navigation mobile">{navigation.map((item) => <button key={item.id} type="button" className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span>{item.icon}</span><small>{item.label === "Entraînement" ? "Entraîner" : item.label}</small></button>)}</nav>
    </div>
  );
}

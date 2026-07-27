"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Chess } from "chess.js";
import { AdaptiveCoachPlanner, defaultSignals, DeterministicCoachNarrator } from "../lib/coach";
import { cacheGames, queueAttempt, syncPendingAttempts } from "../lib/offline-db";
import type { Game, PlayerProfile } from "../lib/types";
import { ChessBoardPanel } from "./components/ChessBoardPanel";

type Tab = "today" | "play" | "training" | "games" | "progress";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const profile: PlayerProfile = {
  id: "vincentito",
  chessComUsername: "vincentito",
  displayName: "Vincent",
  blitzRating: 1373,
  blitzPeak: 1501,
  targetRating: 1500,
  dailyMinutes: 20,
  skillRatings: { openings: 1300, tactics: 1350, strategy: 1250, endgames: 1400, time: 1280 },
  strengths: ["Finales", "Scandinave avec les Noirs"],
  focusAreas: ["Plans de milieu de jeu", "Décisions sous pression"],
};

const plan = new AdaptiveCoachPlanner().buildDailyPlan(profile, defaultSignals, new Date());
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

function TodayView({ onStart }: { onStart: () => void }) {
  const completed = plan.steps.filter((step) => step.completed).length;
  return (
    <div className="view-stack">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow">Séance du jour · {plan.durationMinutes} min</span>
          <h1>{plan.headline}</h1>
          <p>{plan.rationale}</p>
          <button className="primary-button" type="button" onClick={onStart}>Reprendre ma séance <span>→</span></button>
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
              <button className={`step-row ${step.completed ? "done" : ""} ${index === completed ? "active" : ""}`} key={step.id} type="button" onClick={onStart}>
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

function TrainingView() {
  const [feedback, setFeedback] = useState<string | null>(null);
  const handleResult = async (correct: boolean, move: string) => {
    setFeedback(correct ? "Position comprise. Elle reviendra dans 3 jours." : "À revoir demain : cherchez 0-0-0 pour connecter la tour.");
    await queueAttempt({
      id: crypto.randomUUID(),
      exerciseId: "castle-activation",
      move,
      correct,
      responseMs: 0,
      createdAt: new Date().toISOString(),
      synced: false,
    });
  };
  return (
    <div className="training-layout">
      <div>
        <span className="eyebrow">Étape 3 sur 5 · Stratégie</span>
        <h1>Activez votre dernière pièce</h1>
        <p className="lead">Cette position vient d’un motif récurrent : vous avez de bons coups, mais vous retardez la coordination des tours.</p>
        <ChessBoardPanel mode="exercise" expectedMove="e1c1" onExerciseResult={handleResult} />
      </div>
      <aside className="panel exercise-coach">
        <div className="coach-avatar">♞</div>
        <h2>Question du coach</h2>
        <p>Quel coup termine le développement, protège le roi et rend immédiatement la tour active ?</p>
        <div className="thinking-list"><span>1</span><p>Repérez votre pièce la moins active.</p><span>2</span><p>Vérifiez les menaces adverses.</p><span>3</span><p>Comparez les deux meilleurs plans.</p></div>
        {feedback && <div className="feedback" role="status">{feedback}</div>}
      </aside>
    </div>
  );
}

function GamesView() {
  const [games, setGames] = useState<Game[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("Analyse prioritaire : 300 dernières parties rapid/blitz");
  const sync = async () => {
    setSyncing(true);
    setMessage("Import incrémental depuis Chess.com…");
    try {
      const response = await fetch("/api/chesscom/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: profile.chessComUsername, limit: 300 }) });
      if (!response.ok) throw new Error("sync");
      const data = await response.json() as { games: Game[]; imported: number };
      setGames(data.games);
      await cacheGames(data.games);
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
      const sourceId = crypto.randomUUID();
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

          <div className="table-row" key={game.id}><span><strong>{game.white} – {game.black}</strong><small>{new Date(game.playedAt).toLocaleDateString("fr-FR")}</small></span><span>{game.timeClass}</span><span className={`result ${game.result}`}>{game.result === "win" ? "Victoire" : game.result === "loss" ? "Défaite" : "Nulle"}</span><span>{game.analyzed ? "✓ Prête" : "En attente"}</span></div>
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

  const title = useMemo(() => navigation.find((item) => item.id === tab)?.label, [tab]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#today" onClick={() => setTab("today")}><span>♞</span><div><strong>ChessCoach</strong><small>Votre jeu. Votre plan.</small></div></a>
        <nav aria-label="Navigation principale">{navigation.map((item) => <button key={item.id} type="button" className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span>{item.icon}</span>{item.label}{item.id === "today" && <i>3</i>}</button>)}</nav>
        <div className="sidebar-goal"><span>Objectif blitz</span><div><strong>1373</strong><b>/ 1500</b></div><div className="goal-meter"><span style={{ width: "58%" }} /></div><small>127 points à gagner</small></div>
        <div className="sidebar-profile"><span>VC</span><div><strong>Vincent</strong><small>@vincentito</small></div><button aria-label="Réglages">···</button></div>
      </aside>

      <main>
        <header className="topbar">
          <div><span className="mobile-knight">♞</span><p>{title}</p></div>
          <div className="top-actions"><span className={`connection ${online ? "" : "offline"}`}>{online ? "Synchronisé" : "Mode hors ligne"}</span>{installPrompt && <button className="install-button" type="button" onClick={() => installPrompt.prompt()}>Installer l’app</button>}<div className="streak"><span>♨</span><strong>4</strong><small>jours</small></div><span className="avatar">VC</span></div>
        </header>
        <div className="content">
          {tab === "today" && <TodayView onStart={() => setTab("training")} />}
          {tab === "play" && <div className="play-layout"><div><span className="eyebrow">Partie d’entraînement</span><h1>Jouez contre votre coach</h1><p className="lead">Stockfish 18 Lite fonctionne aussi hors ligne. Le niveau s’adapte, sans jouer des coups absurdes.</p><ChessBoardPanel /></div><aside className="panel play-coach"><div className="coach-avatar">♞</div><h2>Contrat de la partie</h2><p>Avant chaque coup calme, formulez un plan en une phrase : pire pièce, faiblesse cible, échange utile.</p><div className="contract-item"><span>Focus</span><strong>Milieu de jeu</strong></div><div className="contract-item"><span>Cadence mentale</span><strong>2 candidats</strong></div><div className="contract-item"><span>Analyse</span><strong>Après la partie</strong></div></aside></div>}
          {tab === "training" && <TrainingView />}
          {tab === "games" && <GamesView />}
          {tab === "progress" && <ProgressView />}
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Navigation mobile">{navigation.map((item) => <button key={item.id} type="button" className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span>{item.icon}</span><small>{item.label === "Entraînement" ? "Entraîner" : item.label}</small></button>)}</nav>
    </div>
  );
}
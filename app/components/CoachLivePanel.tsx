"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceCoach } from "./VoiceCoach";

type Props = {
  fen?: string;
  stepTitle?: string;
  playedMove?: string;
  bestMove?: string;
  evaluationLoss?: number;
  explanation?: string;
  automaticQuestion?: string;
  automaticKey?: string;
  floatingOnMobile?: boolean;
};

type Message = { role: "coach" | "player"; text: string; source?: "openai" | "deterministic" };

export function CoachLivePanel({
  fen,
  stepTitle,
  playedMove,
  bestMove,
  evaluationLoss,
  explanation,
  automaticQuestion,
  automaticKey,
  floatingOnMobile = false,
}: Props) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const lastAutomaticKey = useRef<string | undefined>(undefined);

  const ask = useCallback(async (nextQuestion: string) => {
    const trimmed = nextQuestion.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setMessages((current) => [...current, { role: "player", text: trimmed }]);
    setQuestion("");
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          fen,
          stepTitle,
          playedMove,
          bestMove,
          evaluationLoss,
          explanation,
        }),
      });
      const payload = await response.json() as { answer?: string; source?: "openai" | "deterministic"; error?: string };
      setMessages((current) => [...current, {
        role: "coach",
        text: payload.answer ?? payload.error ?? "Je n’ai pas pu analyser cette position.",
        source: payload.source,
      }]);
    } catch {
      setMessages((current) => [...current, { role: "coach", text: "Connexion au coach indisponible." }]);
    } finally {
      setLoading(false);
    }
  }, [bestMove, evaluationLoss, explanation, fen, loading, playedMove, stepTitle]);

  useEffect(() => {
    if (!automaticQuestion || !automaticKey || lastAutomaticKey.current === automaticKey) return;
    lastAutomaticKey.current = automaticKey;
    const openTimer = floatingOnMobile ? window.setTimeout(() => setMobileOpen(true), 0) : undefined;
    void ask(automaticQuestion);
    return () => {
      if (openTimer !== undefined) window.clearTimeout(openTimer);
    };
  }, [ask, automaticKey, automaticQuestion, floatingOnMobile]);

  return (
    <div className={`coach-live-shell ${floatingOnMobile ? "mobile-floating" : ""} ${mobileOpen ? "open" : ""}`}>
      {floatingOnMobile && (
        <>
          <button
            className="coach-fab"
            type="button"
            aria-label="Ouvrir le coach en direct"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <span aria-hidden="true">♞</span>
            {messages.length > 0 && <i aria-hidden="true" />}
          </button>
          <button className="coach-live-backdrop" type="button" aria-label="Fermer le coach" onClick={() => setMobileOpen(false)} />
        </>
      )}
      <section
        className="coach-live"
        role={floatingOnMobile && mobileOpen ? "dialog" : undefined}
        aria-modal={floatingOnMobile && mobileOpen ? true : undefined}
        aria-label="Coach en direct"
      >
        <div className="coach-live-heading">
          <div><span>♞</span><strong>Coach en direct</strong></div>
          <small>IA + contexte Stockfish</small>
          {floatingOnMobile && (
            <button className="coach-live-close" type="button" aria-label="Fermer le coach" onClick={() => setMobileOpen(false)}>×</button>
          )}
        </div>
        <VoiceCoach
          fen={fen}
          stepTitle={stepTitle}
          playedMove={playedMove}
          bestMove={bestMove}
          evaluationLoss={evaluationLoss}
          explanation={explanation}
          onTranscript={(message) => setMessages((current) => [...current, message])}
        />
        <div className="coach-live-suggestions">
          <button type="button" onClick={() => ask("Explique-moi cette position simplement.")}>Expliquer</button>
          <button type="button" onClick={() => ask("Quels sont les deux meilleurs plans candidats ?")}>Comparer les plans</button>
          <button type="button" onClick={() => ask("Quelle menace dois-je vérifier en premier ?")}>Voir la menace</button>
        </div>
        {messages.length > 0 && (
          <div className="coach-live-messages" aria-live="polite">
            {messages.slice(-4).map((message, index) => (
              <p key={`${message.role}-${index}`} className={message.role}>
                <strong>{message.role === "coach" ? "Coach" : "Vous"}</strong>
                {message.text}
                {message.role === "coach" && message.source === "deterministic" && <small>Mode sans crédit IA</small>}
              </p>
            ))}
          </div>
        )}
        <form onSubmit={(event) => { event.preventDefault(); void ask(question); }}>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Posez une question sur la position…" maxLength={600} />
          <button type="submit" disabled={loading || !question.trim()}>{loading ? "…" : "Envoyer"}</button>
        </form>
      </section>
    </div>
  );
}

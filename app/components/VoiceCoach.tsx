"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeItem, RealtimeSession } from "@openai/agents/realtime";

type VoiceContext = {
  fen?: string;
  stepTitle?: string;
  playedMove?: string;
  bestMove?: string;
  evaluationLoss?: number;
  explanation?: string;
};

type VoiceStatus = "idle" | "connecting" | "listening" | "speaking" | "error";

type Props = VoiceContext & {
  onTranscript: (message: { role: "coach" | "player"; text: string; source: "openai" }) => void;
};

const transcriptFromItem = (item: RealtimeItem) => {
  if (item.type !== "message" || (item.role !== "user" && item.role !== "assistant") || item.status !== "completed") {
    return null;
  }
  const text = item.content.map((part) => {
    if (part.type === "input_text" || part.type === "output_text") return part.text;
    if (part.type === "input_audio" || part.type === "output_audio") return part.transcript ?? "";
    return "";
  }).filter(Boolean).join(" ").trim();
  if (!text) return null;
  return { id: item.itemId, role: item.role === "assistant" ? "coach" as const : "player" as const, text };
};

export function VoiceCoach({
  fen,
  stepTitle,
  playedMove,
  bestMove,
  evaluationLoss,
  explanation,
  onTranscript,
}: Props) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const sessionRef = useRef<RealtimeSession | null>(null);
  const contextRef = useRef<VoiceContext>({});
  const seenItems = useRef(new Set<string>());
  const connectionAttempt = useRef(0);

  useEffect(() => {
    contextRef.current = { fen, stepTitle, playedMove, bestMove, evaluationLoss, explanation };
  }, [bestMove, evaluationLoss, explanation, fen, playedMove, stepTitle]);

  const stop = useCallback(() => {
    connectionAttempt.current += 1;
    sessionRef.current?.close();
    sessionRef.current = null;
    seenItems.current.clear();
    setMuted(false);
    setStatus("idle");
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    if (status !== "idle" && status !== "error") return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("Le micro nécessite une connexion HTTPS et une autorisation du téléphone.");
      setStatus("error");
      return;
    }

    setError("");
    setStatus("connecting");
    const attempt = connectionAttempt.current + 1;
    connectionAttempt.current = attempt;
    try {
      const tokenResponse = await fetch("/api/realtime/token", { method: "POST" });
      const token = await tokenResponse.json() as { value?: string; error?: string };
      if (!tokenResponse.ok || !token.value) throw new Error(token.error ?? "Connexion vocale impossible.");
      if (connectionAttempt.current !== attempt) return;

      const { RealtimeAgent, RealtimeSession, tool } = await import("@openai/agents/realtime");
      const readPosition = tool({
        name: "lire_position_actuelle",
        description: "Lit la position et les données Stockfish actuellement affichées. À appeler avant toute analyse échiquéenne.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: false,
        },
        execute: () => JSON.stringify(contextRef.current),
      });
      const agent = new RealtimeAgent({
        name: "ChessCoach vocal",
        voice: "marin",
        tools: [readPosition],
        instructions: `Tu es le coach vocal personnel francophone. Utilise uniquement l'objectif Elo et le contexte transmis par l'application.
Parle avec une voix calme, chaleureuse, précise et naturelle. Réponds normalement en 2 à 5 phrases.
Avant toute analyse d’une position, appelle lire_position_actuelle. Stockfish reste la source de vérité tactique.
N’invente jamais un meilleur coup ou une variante forcée si le contexte ne les fournit pas.
Structure tes réponses : menace immédiate, idée positionnelle, règle réutilisable, puis au maximum une question.
Ne récite jamais une FEN. Prononce clairement les coups : par exemple « cavalier prend e cinq » plutôt que « C x e 5 ».
Si l’audio est ambigu, demande une confirmation courte. Laisse le joueur t’interrompre et ne parle pas au démarrage.`,
      });
      const session = new RealtimeSession(agent, {
        model: "gpt-realtime-2.1-mini",
        transport: "webrtc",
        workflowName: "ChessCoach vocal",
        config: {
          outputModalities: ["audio"],
          reasoning: { effort: "low" },
          audio: {
            input: {
              noiseReduction: { type: "near_field" },
              transcription: {
                model: "gpt-4o-transcribe",
                language: "fr",
                prompt: "Conversation d’échecs en français. Vocabulaire : Stockfish, FEN, roque, en passant, zugzwang, échiquier, noms des cases et notation algébrique.",
              },
              turnDetection: {
                type: "semantic_vad",
                eagerness: "medium",
                createResponse: true,
                interruptResponse: true,
              },
            },
            output: { voice: "marin", speed: 1 },
          },
        },
      });

      session.on("audio_start", () => setStatus("speaking"));
      session.on("audio_stopped", () => setStatus("listening"));
      session.on("audio_interrupted", () => setStatus("listening"));
      session.on("history_updated", (history) => {
        for (const item of history) {
          const transcript = transcriptFromItem(item);
          if (!transcript || seenItems.current.has(transcript.id)) continue;
          seenItems.current.add(transcript.id);
          onTranscript({ role: transcript.role, text: transcript.text, source: "openai" });
        }
      });
      session.on("error", () => {
        session.close();
        if (sessionRef.current === session) sessionRef.current = null;
        setError("La conversation vocale a été interrompue. Vous pouvez la relancer.");
        setStatus("error");
      });

      sessionRef.current = session;
      await session.connect({ apiKey: token.value });
      if (connectionAttempt.current !== attempt) {
        session.close();
        return;
      }
      setStatus("listening");
    } catch (caught) {
      if (connectionAttempt.current !== attempt) return;
      sessionRef.current?.close();
      sessionRef.current = null;
      const message = caught instanceof Error ? caught.message : "Connexion vocale impossible.";
      setError(message.includes("Permission") || message.includes("NotAllowed")
        ? "Autorisez le micro dans les réglages du téléphone pour parler au coach."
        : message);
      setStatus("error");
    }
  }, [onTranscript, status]);

  const toggleMute = () => {
    const next = !muted;
    sessionRef.current?.mute(next);
    setMuted(next);
  };

  const label = status === "connecting" ? "Connexion…"
    : status === "listening" ? "Je vous écoute"
      : status === "speaking" ? "Le coach parle"
        : "Parler au coach";

  return (
    <div className={`voice-coach ${status}`}>
      {status === "idle" || status === "error" ? (
        <button type="button" className="voice-primary" onClick={() => void start()}>
          <span aria-hidden="true">●</span>{label}
        </button>
      ) : (
        <>
          <div className="voice-state" aria-live="polite">
            <span className="voice-pulse" aria-hidden="true" />
            <strong>{label}</strong>
          </div>
          <div className="voice-actions">
            <button type="button" onClick={toggleMute}>{muted ? "Réactiver le micro" : "Couper le micro"}</button>
            {status === "speaking" && <button type="button" onClick={() => sessionRef.current?.interrupt()}>Interrompre</button>}
            <button type="button" className="voice-stop" onClick={stop}>Terminer</button>
          </div>
        </>
      )}
      {error && <small className="voice-error">{error}</small>}
    </div>
  );
}

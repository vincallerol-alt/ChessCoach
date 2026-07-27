import type { Metadata } from "next";
import { ChessCoachApp } from "./ChessCoachApp";

export const metadata: Metadata = {
  title: "ChessCoach — votre entraînement d’échecs personnel",
  description: "Une séance quotidienne adaptative basée sur vos parties Chess.com.",
};

export default function Home() {
  return <ChessCoachApp />;
}
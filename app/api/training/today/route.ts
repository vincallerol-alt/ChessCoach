import { AdaptiveCoachPlanner, defaultSignals } from "../../../../lib/coach";
import type { PlayerProfile } from "../../../../lib/types";

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

export async function GET() {
  const plan = new AdaptiveCoachPlanner().buildDailyPlan(profile, defaultSignals, new Date());
  return Response.json({ profile, signals: defaultSignals, plan });
}
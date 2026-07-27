import { defaultSignals } from "../../../lib/coach";

export async function GET() {
  return Response.json({
    currentRating: 1373,
    peakRating: 1501,
    targetRating: 1500,
    weeklyDelta: 45,
    firstTrySuccess: 0.71,
    timePressureBlunderDelta: -0.18,
    skillRatings: { openings: 1300, tactics: 1350, strategy: 1250, endgames: 1400, time: 1280 },
    weaknesses: defaultSignals,
  });
}
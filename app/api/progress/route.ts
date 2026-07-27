import coachSnapshot from "../../../data/coach-snapshot.json";

export async function GET() {
  return Response.json({
    ...coachSnapshot.metrics,
    targetRating: coachSnapshot.profile.targetRating,
    skillRatings: coachSnapshot.profile.skillRatings,
    weaknesses: coachSnapshot.signals,
    generatedAt: coachSnapshot.generatedAt,
  });
}

import type { PlayerProfile, TrainingProgram, WeaknessSignal } from "../../../../lib/types";
import coachSnapshot from "../../../../data/coach-snapshot.json";

export async function GET() {
  const profile = coachSnapshot.profile as PlayerProfile;
  const signals = coachSnapshot.signals as WeaknessSignal[];
  const program = coachSnapshot.program as TrainingProgram;
  const today = new Date().toISOString().slice(0, 10);
  const plan = program.sessions.find((session) => session.date === today) ?? program.sessions[0];
  return Response.json({
    profile,
    signals,
    exercises: coachSnapshot.exercises,
    analysis: coachSnapshot.analysis,
    program,
    plan,
  });
}

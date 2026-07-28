import { GET as getCloudState } from "../../sync/route";
import type { CloudState } from "../../../../lib/cloud-sync";
import { buildTrainingProgram, createEmptyProfile, deriveProfile, deriveWeaknessSignals } from "../../../../lib/runtime-coach";

export async function GET() {
  const response = await getCloudState();
  if (!response.ok) return response;
  const state = await response.json() as CloudState;
  const base = {
    ...createEmptyProfile(),
    ...(state.profile ?? {}),
  };
  const signals = deriveWeaknessSignals(state.games, state.attempts, state.exercises);
  const profile = deriveProfile(base, state.games, signals);
  const program = buildTrainingProgram(
    profile,
    signals,
    state.exercises,
    state.games.filter((game) => game.analyzed).length,
    new Date(),
    state.plans,
  );
  const today = new Date().toISOString().slice(0, 10);
  return Response.json({
    profile,
    signals,
    exercises: state.exercises,
    program,
    plan: program.sessions.find((session) => session.date === today) ?? program.sessions[0],
  });
}

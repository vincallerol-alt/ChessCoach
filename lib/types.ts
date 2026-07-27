export type SkillArea = "openings" | "tactics" | "strategy" | "endgames" | "time";

export type PlayerProfile = {
  id: string;
  chessComUsername: string;
  displayName: string;
  blitzRating: number;
  blitzPeak: number;
  targetRating: number;
  dailyMinutes: number;
  skillRatings: Record<SkillArea, number>;
  strengths: string[];
  focusAreas: string[];
};

export type Game = {
  id: string;
  source: "chess.com" | "pgn" | "chesscoach";
  sourceId: string;
  playedAt: string;
  timeClass: "bullet" | "blitz" | "rapid" | "daily" | "other";
  playerColor: "white" | "black";
  result: "win" | "loss" | "draw";
  white: string;
  black: string;
  whiteRating?: number;
  blackRating?: number;
  pgn: string;
  url?: string;
  analyzed: boolean;
};

export type BotGameSummary = {
  pgn: string;
  result: Game["result"];
  timeClass: Game["timeClass"];
  timeControl: string;
  playedAt: string;
};

export type PositionAnalysis = {
  fen: string;
  ply: number;
  evaluationCp: number;
  bestMove: string;
  playedMove?: string;
  centipawnLoss?: number;
  multipv: Array<{ move: string; evaluationCp: number; line: string[] }>;
  depth: number;
};

export type WeaknessSignal = {
  id: string;
  area: SkillArea;
  label: string;
  recurrence: number;
  evaluationLoss: number;
  recency: number;
  timePressure: number;
  failedAttempts: number;
  priority: number;
};

export type Exercise = {
  id: string;
  title: string;
  area: SkillArea;
  fen: string;
  sideToMove: "white" | "black";
  expectedMoves: string[];
  explanation: string;
  source: "personal" | "coach" | "external";
  sourceUrl?: string;
  dueAt: string;
  intervalDays: number;
  centipawnLoss?: number;
};

export type Attempt = {
  id: string;
  exerciseId: string;
  move: string;
  correct: boolean;
  responseMs: number;
  createdAt: string;
  synced: boolean;
};

export type TrainingPlan = {
  id: string;
  date: string;
  durationMinutes: number;
  sessionKind?: "training" | "match";
  focus: SkillArea;
  headline: string;
  rationale: string;
  playMission?: string;
  steps: Array<{
    id: string;
    kind: "replay" | "review" | "exercise" | "mini-game" | "summary";
    title: string;
    minutes: number;
    completed: boolean;
  }>;
};

export type TrainingProgram = {
  id: string;
  startDate: string;
  endDate: string;
  sourceGameCount: number;
  sessions: TrainingPlan[];
};

export interface GameSourceAdapter {
  importGames(username: string, limit?: number): Promise<Game[]>;
}

export interface EngineAdapter {
  ready(): Promise<void>;
  bestMove(fen: string, skillLevel: number, moveTimeMs?: number): Promise<string>;
  analyze(fen: string, depth?: number, multiPv?: number): Promise<PositionAnalysis>;
  dispose(): void;
}

export interface CoachPlanner {
  buildDailyPlan(profile: PlayerProfile, signals: WeaknessSignal[], date: Date): TrainingPlan;
}

export interface CoachNarrator {
  explain(area: SkillArea, context: { move?: string; evaluationLoss?: number }): string;
}

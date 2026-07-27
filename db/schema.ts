import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  email: text("email").primaryKey(),
  chessComUsername: text("chess_com_username").notNull().default("vincentito"),
  displayName: text("display_name").notNull().default("Vincent"),
  targetRating: integer("target_rating").notNull().default(1500),
  dailyMinutes: integer("daily_minutes").notNull().default(20),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const games = sqliteTable("games", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  sourceId: text("source_id").notNull().unique(),
  source: text("source").notNull().default("chess.com"),
  username: text("username").notNull(),
  playedAt: text("played_at").notNull(),
  timeClass: text("time_class").notNull(),
  playerColor: text("player_color").notNull(),
  result: text("result").notNull(),
  white: text("white").notNull(),
  black: text("black").notNull(),
  whiteRating: integer("white_rating"),
  blackRating: integer("black_rating"),
  pgn: text("pgn").notNull(),
  url: text("url"),
  timeControl: text("time_control"),
  criticalPositions: text("critical_positions", { mode: "json" }),
  analyzed: integer("analyzed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
}, (table) => [index("games_owner_played_idx").on(table.ownerEmail, table.playedAt)]);

export const weaknessSignals = sqliteTable("weakness_signals", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  area: text("area").notNull(),
  label: text("label").notNull(),
  recurrence: real("recurrence").notNull(),
  evaluationLoss: real("evaluation_loss").notNull(),
  recency: real("recency").notNull(),
  timePressure: real("time_pressure").notNull(),
  failedAttempts: real("failed_attempts").notNull(),
  priority: real("priority").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  title: text("title").notNull(),
  area: text("area").notNull(),
  fen: text("fen").notNull(),
  expectedMoves: text("expected_moves", { mode: "json" }).notNull(),
  explanation: text("explanation").notNull(),
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  dueAt: text("due_at").notNull(),
  intervalDays: integer("interval_days").notNull().default(1),
  centipawnLoss: integer("centipawn_loss"),
  originGameId: text("origin_game_id"),
  comparisonMove: text("comparison_move"),
});

export const attempts = sqliteTable("attempts", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  exerciseId: text("exercise_id").notNull(),
  move: text("move").notNull(),
  correct: integer("correct", { mode: "boolean" }).notNull(),
  responseMs: integer("response_ms").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("attempts_owner_created_idx").on(table.ownerEmail, table.createdAt)]);

export const trainingPlans = sqliteTable("training_plans", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  date: text("date").notNull(),
  focus: text("focus").notNull(),
  plan: text("plan", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("plans_owner_date_idx").on(table.ownerEmail, table.date)]);

CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`exercise_id` text NOT NULL,
	`move` text NOT NULL,
	`correct` integer NOT NULL,
	`response_ms` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attempts_owner_created_idx` ON `attempts` (`owner_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`title` text NOT NULL,
	`area` text NOT NULL,
	`fen` text NOT NULL,
	`expected_moves` text NOT NULL,
	`explanation` text NOT NULL,
	`source` text NOT NULL,
	`source_url` text,
	`due_at` text NOT NULL,
	`interval_days` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`source_id` text NOT NULL,
	`username` text NOT NULL,
	`played_at` text NOT NULL,
	`time_class` text NOT NULL,
	`player_color` text NOT NULL,
	`result` text NOT NULL,
	`white` text NOT NULL,
	`black` text NOT NULL,
	`white_rating` integer,
	`black_rating` integer,
	`pgn` text NOT NULL,
	`url` text,
	`analyzed` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_source_id_unique` ON `games` (`source_id`);--> statement-breakpoint
CREATE INDEX `games_owner_played_idx` ON `games` (`owner_email`,`played_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`email` text PRIMARY KEY NOT NULL,
	`chess_com_username` text DEFAULT 'vincentito' NOT NULL,
	`display_name` text DEFAULT 'Vincent' NOT NULL,
	`target_rating` integer DEFAULT 1500 NOT NULL,
	`daily_minutes` integer DEFAULT 20 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `training_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`date` text NOT NULL,
	`focus` text NOT NULL,
	`plan` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `plans_owner_date_idx` ON `training_plans` (`owner_email`,`date`);--> statement-breakpoint
CREATE TABLE `weakness_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`area` text NOT NULL,
	`label` text NOT NULL,
	`recurrence` real NOT NULL,
	`evaluation_loss` real NOT NULL,
	`recency` real NOT NULL,
	`time_pressure` real NOT NULL,
	`failed_attempts` real NOT NULL,
	`priority` real NOT NULL,
	`updated_at` text NOT NULL
);

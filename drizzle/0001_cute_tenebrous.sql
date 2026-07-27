ALTER TABLE `exercises` ADD `centipawn_loss` integer;--> statement-breakpoint
ALTER TABLE `exercises` ADD `origin_game_id` text;--> statement-breakpoint
ALTER TABLE `exercises` ADD `comparison_move` text;--> statement-breakpoint
ALTER TABLE `games` ADD `source` text DEFAULT 'chess.com' NOT NULL;--> statement-breakpoint
ALTER TABLE `games` ADD `time_control` text;--> statement-breakpoint
ALTER TABLE `games` ADD `critical_positions` text;
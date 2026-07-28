PRAGMA foreign_keys=OFF;--> statement-breakpoint
ALTER TABLE `profiles` ADD `blitz_rating` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `blitz_peak` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE `__new_profiles` (
	`email` text PRIMARY KEY NOT NULL,
	`chess_com_username` text DEFAULT '' NOT NULL,
	`display_name` text DEFAULT 'Joueur' NOT NULL,
	`blitz_rating` integer DEFAULT 0 NOT NULL,
	`blitz_peak` integer DEFAULT 0 NOT NULL,
	`target_rating` integer DEFAULT 1500 NOT NULL,
	`daily_minutes` integer DEFAULT 20 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_profiles`("email", "chess_com_username", "display_name", "blitz_rating", "blitz_peak", "target_rating", "daily_minutes", "created_at", "updated_at") SELECT "email", "chess_com_username", "display_name", "blitz_rating", "blitz_peak", "target_rating", "daily_minutes", "created_at", "updated_at" FROM `profiles`;--> statement-breakpoint
DROP TABLE `profiles`;--> statement-breakpoint
ALTER TABLE `__new_profiles` RENAME TO `profiles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;

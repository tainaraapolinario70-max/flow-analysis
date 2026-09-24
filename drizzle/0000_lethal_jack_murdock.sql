CREATE TABLE IF NOT EXISTS `daily_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`school_name` text NOT NULL,
	`record_date` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`responsible` text,
	`status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_daily_records_school_id` ON `daily_records` (`school_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `school_updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`school_name` text NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_school_updates_school_id` ON `school_updates` (`school_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_school_updates_type` ON `school_updates` (`type`);

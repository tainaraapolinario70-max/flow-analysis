CREATE TABLE `school_accesses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`school_id` integer NOT NULL,
	`school_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_school_accesses_created_at` ON `school_accesses` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_school_accesses_school_id` ON `school_accesses` (`school_id`);
CREATE TABLE `validation_records` (
	`validation_school_id` integer PRIMARY KEY NOT NULL,
	`school_name` text NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_validation_records_status` ON `validation_records` (`status`);

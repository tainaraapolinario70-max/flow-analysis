CREATE TABLE `deleted_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`title` text NOT NULL,
	`payload` text NOT NULL,
	`deleted_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_deleted_items_entity_type` ON `deleted_items` (`entity_type`);--> statement-breakpoint
CREATE INDEX `idx_deleted_items_deleted_at` ON `deleted_items` (`deleted_at`);
CREATE TABLE `artifact` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`size` integer NOT NULL,
	`r2_key` text NOT NULL,
	`root_path` text DEFAULT '' NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `artifact_project_created` ON `artifact` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `artifact_expires` ON `artifact` (`expires_at`);--> statement-breakpoint
CREATE INDEX `artifact_deleted` ON `artifact` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `artifact_file` (
	`artifact_id` text NOT NULL,
	`path` text NOT NULL,
	`offset` integer NOT NULL,
	`compressed_size` integer NOT NULL,
	`size` integer NOT NULL,
	`method` integer NOT NULL,
	`crc32` integer NOT NULL,
	PRIMARY KEY(`artifact_id`, `path`),
	FOREIGN KEY (`artifact_id`) REFERENCES `artifact`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`display_name` text,
	`ttl_seconds` integer,
	`created_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_user_name` ON `project` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `token` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `token_hash_unique` ON `token` (`hash`);--> statement-breakpoint
CREATE TABLE `upload_ticket` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`ttl_seconds` integer,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);

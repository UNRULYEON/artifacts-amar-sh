DROP INDEX `project_user_name`;--> statement-breakpoint
CREATE UNIQUE INDEX `project_user_name` ON `project` (`user_id`,`name`) WHERE deleted_at IS NULL;
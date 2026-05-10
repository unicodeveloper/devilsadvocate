CREATE TABLE `audit_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`memo_run_id` text NOT NULL,
	`agent_name` text NOT NULL,
	`model` text NOT NULL,
	`prompt_json` text NOT NULL,
	`raw_output` text NOT NULL,
	`valyu_responses_json` text,
	`duration_ms` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`memo_run_id`) REFERENCES `memo_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `house_view_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`updated_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `memo_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`memo_id` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`house_view_version_id` text,
	`areas_of_concern_snapshot` text,
	`thesis_snapshot` text NOT NULL,
	`synthesized_memo_json` text,
	`error_message` text,
	`started_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`memo_id`) REFERENCES `memos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`house_view_version_id`) REFERENCES `house_view_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `memos` (
	`id` text PRIMARY KEY NOT NULL,
	`stock_ticker` text NOT NULL,
	`stock_name` text NOT NULL,
	`stock_exchange` text,
	`thesis` text NOT NULL,
	`areas_of_concern` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`reviewed_by_user_id` text,
	`review_comment` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
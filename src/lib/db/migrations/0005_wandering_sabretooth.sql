CREATE TABLE `critic_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`display_name` text NOT NULL,
	`description` text NOT NULL,
	`severity` text NOT NULL,
	`source` text NOT NULL,
	`evaluator_kind` text NOT NULL,
	`evaluator_config` text DEFAULT '{}' NOT NULL,
	`rationale_template` text,
	`scope` text DEFAULT 'both' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `critic_rules_slug_unique` ON `critic_rules` (`slug`);--> statement-breakpoint
CREATE TABLE `objection_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`objection_id` text NOT NULL,
	`author_kind` text NOT NULL,
	`author_user_id` text,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`objection_id`) REFERENCES `objections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `objections` (
	`id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`rule_id` text,
	`type` text NOT NULL,
	`severity` text NOT NULL,
	`anchor_section` text NOT NULL,
	`anchor_excerpt` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`recommendation` text,
	`evidence_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rule_id`) REFERENCES `critic_rules`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`memo_id` text NOT NULL,
	`memo_version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`decision` text,
	`confidence_x100` integer,
	`summary` text,
	`engine_version` text NOT NULL,
	`engine_model` text NOT NULL,
	`prompt_hash` text NOT NULL,
	`ruleset_hash` text NOT NULL,
	`house_view_version_id` text,
	`memo_run_id` text,
	`error_message` text,
	`started_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`memo_id`) REFERENCES `memos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`house_view_version_id`) REFERENCES `house_view_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`memo_run_id`) REFERENCES `memo_runs`(`id`) ON UPDATE no action ON DELETE set null
);

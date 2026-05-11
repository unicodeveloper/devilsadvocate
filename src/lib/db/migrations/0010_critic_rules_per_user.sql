-- Per-FM custom rules + per-FM overrides on built-in rules.
ALTER TABLE `critic_rules` ADD COLUMN `owner_user_id` text REFERENCES `users`(`id`) ON DELETE cascade;
--> statement-breakpoint
-- Backfill: any existing custom rule becomes owned by whoever authored it.
UPDATE `critic_rules` SET `owner_user_id` = `created_by_user_id`
  WHERE `source` = 'custom' AND `owner_user_id` IS NULL AND `created_by_user_id` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `critic_rules_owner_user_id_idx` ON `critic_rules` (`owner_user_id`);
--> statement-breakpoint
CREATE TABLE `critic_rule_user_settings` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
  `rule_id` text NOT NULL REFERENCES `critic_rules`(`id`) ON DELETE cascade,
  `enabled` integer NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `critic_rule_user_settings_user_rule_uq`
  ON `critic_rule_user_settings` (`user_id`, `rule_id`);

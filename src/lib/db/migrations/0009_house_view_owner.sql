-- Per-FM House View: each row gets an owner. Backfill existing rows by
-- assuming the editor is also the owner (true for the previous single-FM
-- world). NOT NULL is enforced at the app layer via Drizzle's schema since
-- SQLite can't add a NOT NULL FK column without a default.
ALTER TABLE `house_view_versions` ADD COLUMN `owner_user_id` text REFERENCES `users`(`id`) ON DELETE cascade;
--> statement-breakpoint
UPDATE `house_view_versions` SET `owner_user_id` = `updated_by_user_id` WHERE `owner_user_id` IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `house_view_versions_owner_user_id_idx` ON `house_view_versions` (`owner_user_id`);

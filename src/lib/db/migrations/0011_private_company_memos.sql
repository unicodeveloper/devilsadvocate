-- Adds the third `entity_type` value (`private_company`) on `memos`, the
-- inline private-co fields the new flow needs, and the structured
-- private-co mandate fields on `house_view_versions`.
--
-- `entity_type` enum values are enforced at the app layer only (drizzle's
-- text enum is not a CHECK constraint), so no DDL is needed to widen the
-- accepted set — existing rows keep their values and new private_company
-- memos validate against the wider Drizzle enum on insert.

ALTER TABLE `memos` ADD COLUMN `private_company_name` text;
--> statement-breakpoint
ALTER TABLE `memos` ADD COLUMN `private_company_url` text;
--> statement-breakpoint
ALTER TABLE `memos` ADD COLUMN `private_company_founders_json` text;
--> statement-breakpoint
ALTER TABLE `memos` ADD COLUMN `private_company_round_stage` text;
--> statement-breakpoint
ALTER TABLE `memos` ADD COLUMN `private_company_check_size_usd` integer;
--> statement-breakpoint
ALTER TABLE `memos` ADD COLUMN `private_company_post_money_usd` integer;
--> statement-breakpoint
ALTER TABLE `memos` ADD COLUMN `private_company_sector` text;
--> statement-breakpoint
ALTER TABLE `memos` ADD COLUMN `private_company_geo` text;
--> statement-breakpoint
ALTER TABLE `house_view_versions` ADD COLUMN `private_check_size_min_usd` integer;
--> statement-breakpoint
ALTER TABLE `house_view_versions` ADD COLUMN `private_check_size_max_usd` integer;
--> statement-breakpoint
ALTER TABLE `house_view_versions` ADD COLUMN `private_stage_allowlist_json` text;
--> statement-breakpoint
ALTER TABLE `house_view_versions` ADD COLUMN `private_sector_allowlist_json` text;
--> statement-breakpoint
ALTER TABLE `house_view_versions` ADD COLUMN `private_sector_blocklist_json` text;
--> statement-breakpoint
ALTER TABLE `house_view_versions` ADD COLUMN `private_geo_allowlist_json` text;

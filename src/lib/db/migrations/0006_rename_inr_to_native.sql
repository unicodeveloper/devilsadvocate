ALTER TABLE `funds` RENAME COLUMN `aum_inr` TO `aum_native`;--> statement-breakpoint
ALTER TABLE `fund_holdings` RENAME COLUMN `value_inr` TO `value_native`;

PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_memos` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text DEFAULT 'stock' NOT NULL,
	`stock_ticker` text,
	`stock_name` text,
	`stock_exchange` text,
	`fund_id` text,
	`thesis` text NOT NULL,
	`areas_of_concern` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`reviewed_by_user_id` text,
	`review_comment` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`fund_id`) REFERENCES `funds`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_memos`("id", "entity_type", "stock_ticker", "stock_name", "stock_exchange", "fund_id", "thesis", "areas_of_concern", "status", "created_by_user_id", "reviewed_by_user_id", "review_comment", "created_at", "updated_at") SELECT "id", 'stock', "stock_ticker", "stock_name", "stock_exchange", NULL, "thesis", "areas_of_concern", "status", "created_by_user_id", "reviewed_by_user_id", "review_comment", "created_at", "updated_at" FROM `memos`;--> statement-breakpoint
DROP TABLE `memos`;--> statement-breakpoint
ALTER TABLE `__new_memos` RENAME TO `memos`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
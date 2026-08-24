CREATE TABLE `social_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`provider_email` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_accounts_provider_account_idx` ON `social_accounts` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `social_accounts_user_provider_idx` ON `social_accounts` (`user_id`,`provider`);--> statement-breakpoint
CREATE INDEX `social_accounts_user_idx` ON `social_accounts` (`user_id`);
CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`sign_up_enabled` integer DEFAULT true NOT NULL,
	`sign_up_whitelist_enabled` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_whitelist` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_whitelist_email_idx` ON `email_whitelist` (`email`);
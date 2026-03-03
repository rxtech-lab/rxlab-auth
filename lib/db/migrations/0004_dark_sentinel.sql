ALTER TABLE `oauth_clients` ADD `sign_in_permission` text DEFAULT 'all' NOT NULL;--> statement-breakpoint
CREATE TABLE `oauth_client_email_whitelist` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_client_email_whitelist_client_email_idx` ON `oauth_client_email_whitelist` (`client_id`,`email`);--> statement-breakpoint
CREATE INDEX `oauth_client_email_whitelist_client_idx` ON `oauth_client_email_whitelist` (`client_id`);

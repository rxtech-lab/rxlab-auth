CREATE TABLE `oauth_client_app_ids` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`app_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_client_app_ids_client_app_idx` ON `oauth_client_app_ids` (`client_id`,`app_id`);--> statement-breakpoint
CREATE INDEX `oauth_client_app_ids_client_idx` ON `oauth_client_app_ids` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauth_client_app_ids_app_idx` ON `oauth_client_app_ids` (`app_id`);
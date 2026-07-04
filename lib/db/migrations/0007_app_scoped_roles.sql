CREATE TABLE `oauth_client_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_client_roles_client_key_idx` ON `oauth_client_roles` (`client_id`,`key`);--> statement-breakpoint
CREATE INDEX `oauth_client_roles_client_idx` ON `oauth_client_roles` (`client_id`);--> statement-breakpoint
CREATE TABLE `oauth_client_user_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `oauth_client_roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_client_user_roles_unique_idx` ON `oauth_client_user_roles` (`client_id`,`user_id`,`role_id`);--> statement-breakpoint
CREATE INDEX `oauth_client_user_roles_client_user_idx` ON `oauth_client_user_roles` (`client_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `oauth_client_user_roles_user_idx` ON `oauth_client_user_roles` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauth_client_user_roles_role_idx` ON `oauth_client_user_roles` (`role_id`);

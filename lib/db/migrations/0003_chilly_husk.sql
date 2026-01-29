DROP INDEX "users_email_unique";--> statement-breakpoint
DROP INDEX "users_username_unique";--> statement-breakpoint
DROP INDEX "users_email_idx";--> statement-breakpoint
DROP INDEX "users_username_idx";--> statement-breakpoint
DROP INDEX "passkeys_user_idx";--> statement-breakpoint
DROP INDEX "email_verification_tokens_token_unique";--> statement-breakpoint
DROP INDEX "email_verification_tokens_user_idx";--> statement-breakpoint
DROP INDEX "email_verification_tokens_token_idx";--> statement-breakpoint
DROP INDEX "password_reset_tokens_token_unique";--> statement-breakpoint
DROP INDEX "password_reset_tokens_user_idx";--> statement-breakpoint
DROP INDEX "password_reset_tokens_token_idx";--> statement-breakpoint
DROP INDEX "oauth_clients_name_idx";--> statement-breakpoint
DROP INDEX "oauth_consents_user_client_idx";--> statement-breakpoint
DROP INDEX "oauth_consents_user_idx";--> statement-breakpoint
DROP INDEX "oauth_consents_client_idx";--> statement-breakpoint
DROP INDEX "oauth_refresh_tokens_token_unique";--> statement-breakpoint
DROP INDEX "oauth_refresh_tokens_user_idx";--> statement-breakpoint
DROP INDEX "oauth_refresh_tokens_token_idx";--> statement-breakpoint
DROP INDEX "oauth_refresh_tokens_client_idx";--> statement-breakpoint
DROP INDEX "email_whitelist_email_idx";--> statement-breakpoint
ALTER TABLE `oauth_clients` ALTER COLUMN "secret" TO "secret" text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_username_idx` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `passkeys_user_idx` ON `passkeys` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_verification_tokens_token_unique` ON `email_verification_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `email_verification_tokens_user_idx` ON `email_verification_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `email_verification_tokens_token_idx` ON `email_verification_tokens` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `password_reset_tokens_token_unique` ON `password_reset_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `password_reset_tokens_user_idx` ON `password_reset_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `password_reset_tokens_token_idx` ON `password_reset_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `oauth_clients_name_idx` ON `oauth_clients` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_consents_user_client_idx` ON `oauth_consents` (`user_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `oauth_consents_user_idx` ON `oauth_consents` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauth_consents_client_idx` ON `oauth_consents` (`client_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_refresh_tokens_token_unique` ON `oauth_refresh_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `oauth_refresh_tokens_user_idx` ON `oauth_refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauth_refresh_tokens_token_idx` ON `oauth_refresh_tokens` (`token`);--> statement-breakpoint
CREATE INDEX `oauth_refresh_tokens_client_idx` ON `oauth_refresh_tokens` (`client_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_whitelist_email_idx` ON `email_whitelist` (`email`);--> statement-breakpoint
ALTER TABLE `oauth_clients` ADD `client_type` text DEFAULT 'confidential' NOT NULL;
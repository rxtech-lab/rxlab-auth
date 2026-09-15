CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false,
	"password_hash" text,
	"username" text,
	"display_name" text,
	"avatar_seed" text,
	"avatar_url" text,
	"admin_api_permissions" text DEFAULT '[]' NOT NULL,
	"deletion_scheduled_at" timestamp with time zone,
	"deletion_requested_at" timestamp with time zone,
	"deletion_request_id" text,
	"deletion_run_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"device_type" text,
	"backed_up" boolean DEFAULT false,
	"transports" text,
	"created_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "email_verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"provider_email" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_client_email_whitelist" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"client_type" text DEFAULT 'confidential' NOT NULL,
	"secret" text,
	"name" text NOT NULL,
	"description" text,
	"icon_url" text,
	"redirect_uris" text NOT NULL,
	"allowed_scopes" text NOT NULL,
	"is_first_party" boolean DEFAULT false,
	"sign_in_permission" text DEFAULT 'all' NOT NULL,
	"default_role_id" text,
	"sign_in_methods" text,
	"permissions" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_client_app_ids" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"app_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_client_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_client_user_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_consents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"client_id" text NOT NULL,
	"scopes" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"user_id" text NOT NULL,
	"client_id" text NOT NULL,
	"scopes" text NOT NULL,
	"expires_at" timestamp with time zone,
	"authenticated_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "oauth_refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "admin_passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" text,
	"created_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"sign_up_enabled" boolean DEFAULT true NOT NULL,
	"sign_up_whitelist_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_whitelist" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_client_email_whitelist" ADD CONSTRAINT "oauth_client_email_whitelist_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD CONSTRAINT "oauth_clients_default_role_id_oauth_client_roles_id_fk" FOREIGN KEY ("default_role_id") REFERENCES "public"."oauth_client_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_client_app_ids" ADD CONSTRAINT "oauth_client_app_ids_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_client_roles" ADD CONSTRAINT "oauth_client_roles_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_client_user_roles" ADD CONSTRAINT "oauth_client_user_roles_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_client_user_roles" ADD CONSTRAINT "oauth_client_user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_client_user_roles" ADD CONSTRAINT "oauth_client_user_roles_role_id_oauth_client_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."oauth_client_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_consents" ADD CONSTRAINT "oauth_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_consents" ADD CONSTRAINT "oauth_consents_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_deletion_scheduled_at_idx" ON "users" USING btree ("deletion_scheduled_at");--> statement-breakpoint
CREATE INDEX "passkeys_user_idx" ON "passkeys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_verification_tokens_user_idx" ON "email_verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "email_verification_tokens_token_idx" ON "email_verification_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_provider_account_idx" ON "social_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_user_provider_idx" ON "social_accounts" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "social_accounts_user_idx" ON "social_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_client_email_whitelist_client_email_idx" ON "oauth_client_email_whitelist" USING btree ("client_id","email");--> statement-breakpoint
CREATE INDEX "oauth_client_email_whitelist_client_idx" ON "oauth_client_email_whitelist" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_clients_name_idx" ON "oauth_clients" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_client_app_ids_client_app_idx" ON "oauth_client_app_ids" USING btree ("client_id","app_id");--> statement-breakpoint
CREATE INDEX "oauth_client_app_ids_client_idx" ON "oauth_client_app_ids" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_client_app_ids_app_idx" ON "oauth_client_app_ids" USING btree ("app_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_client_roles_client_key_idx" ON "oauth_client_roles" USING btree ("client_id","key");--> statement-breakpoint
CREATE INDEX "oauth_client_roles_client_idx" ON "oauth_client_roles" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_client_user_roles_unique_idx" ON "oauth_client_user_roles" USING btree ("client_id","user_id","role_id");--> statement-breakpoint
CREATE INDEX "oauth_client_user_roles_client_user_idx" ON "oauth_client_user_roles" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "oauth_client_user_roles_user_idx" ON "oauth_client_user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_client_user_roles_role_idx" ON "oauth_client_user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_consents_user_client_idx" ON "oauth_consents" USING btree ("user_id","client_id");--> statement-breakpoint
CREATE INDEX "oauth_consents_user_idx" ON "oauth_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_consents_client_idx" ON "oauth_consents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_refresh_tokens_user_idx" ON "oauth_refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oauth_refresh_tokens_token_idx" ON "oauth_refresh_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "oauth_refresh_tokens_client_idx" ON "oauth_refresh_tokens" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_whitelist_email_idx" ON "email_whitelist" USING btree ("email");
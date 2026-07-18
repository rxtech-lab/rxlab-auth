ALTER TABLE `oauth_clients` ADD `default_role_id` text REFERENCES oauth_client_roles(id) ON DELETE SET NULL;

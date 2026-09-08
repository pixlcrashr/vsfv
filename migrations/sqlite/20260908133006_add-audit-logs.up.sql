-- create "audit_log_entries" table
CREATE TABLE `audit_log_entries` (
  `id` uuid NULL,
  `resource_name` text NOT NULL,
  `resource_id` uuid NOT NULL,
  `organization_id` uuid NULL,
  `action` text NOT NULL DEFAULT '',
  `actor_id` uuid NULL,
  `changes` jsonb NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`)
);
-- create index "idx_audit_log_entries_created_at" to table: "audit_log_entries"
CREATE INDEX `idx_audit_log_entries_created_at` ON `audit_log_entries` (`created_at`);
-- create index "idx_audit_log_entries_actor_id" to table: "audit_log_entries"
CREATE INDEX `idx_audit_log_entries_actor_id` ON `audit_log_entries` (`actor_id`);
-- create index "idx_audit_log_entries_action" to table: "audit_log_entries"
CREATE INDEX `idx_audit_log_entries_action` ON `audit_log_entries` (`action`);
-- create index "idx_audit_log_entries_organization_id" to table: "audit_log_entries"
CREATE INDEX `idx_audit_log_entries_organization_id` ON `audit_log_entries` (`organization_id`);
-- create index "idx_audit_log_entries_resource_id" to table: "audit_log_entries"
CREATE INDEX `idx_audit_log_entries_resource_id` ON `audit_log_entries` (`resource_id`);
-- create index "idx_audit_log_entries_resource_name" to table: "audit_log_entries"
CREATE INDEX `idx_audit_log_entries_resource_name` ON `audit_log_entries` (`resource_name`);

-- reverse: create index "idx_audit_log_entries_resource_name" to table: "audit_log_entries"
DROP INDEX "public"."idx_audit_log_entries_resource_name";
-- reverse: create index "idx_audit_log_entries_resource_id" to table: "audit_log_entries"
DROP INDEX "public"."idx_audit_log_entries_resource_id";
-- reverse: create index "idx_audit_log_entries_organization_id" to table: "audit_log_entries"
DROP INDEX "public"."idx_audit_log_entries_organization_id";
-- reverse: create index "idx_audit_log_entries_created_at" to table: "audit_log_entries"
DROP INDEX "public"."idx_audit_log_entries_created_at";
-- reverse: create index "idx_audit_log_entries_actor_id" to table: "audit_log_entries"
DROP INDEX "public"."idx_audit_log_entries_actor_id";
-- reverse: create index "idx_audit_log_entries_action" to table: "audit_log_entries"
DROP INDEX "public"."idx_audit_log_entries_action";
-- reverse: create "audit_log_entries" table
DROP TABLE "public"."audit_log_entries";

-- reverse: create index "idx_submission_comments_submission_id" to table: "submission_comments"
DROP INDEX "public"."idx_submission_comments_submission_id";
-- reverse: create "submission_comments" table
DROP TABLE "public"."submission_comments";
-- reverse: create index "idx_submission_attachments_storage_key" to table: "submission_attachments"
DROP INDEX "public"."idx_submission_attachments_storage_key";
-- reverse: create index "idx_submission_attachments_item_id" to table: "submission_attachments"
DROP INDEX "public"."idx_submission_attachments_item_id";
-- reverse: create "submission_attachments" table
DROP TABLE "public"."submission_attachments";
-- reverse: create index "idx_submission_items_submission_public_id" to table: "submission_items"
DROP INDEX "public"."idx_submission_items_submission_public_id";
-- reverse: create index "idx_submission_items_submission_id" to table: "submission_items"
DROP INDEX "public"."idx_submission_items_submission_id";
-- reverse: create "submission_items" table
DROP TABLE "public"."submission_items";
-- reverse: create index "idx_submissions_status" to table: "submissions"
DROP INDEX "public"."idx_submissions_status";
-- reverse: create index "idx_submissions_org_public_id" to table: "submissions"
DROP INDEX "public"."idx_submissions_org_public_id";
-- reverse: create index "idx_submissions_org_id" to table: "submissions"
DROP INDEX "public"."idx_submissions_org_id";
-- reverse: create index "idx_submissions_org_custom_id" to table: "submissions"
DROP INDEX "public"."idx_submissions_org_custom_id";
-- reverse: create index "idx_submissions_created_by" to table: "submissions"
DROP INDEX "public"."idx_submissions_created_by";
-- reverse: create index "idx_submissions_committee" to table: "submissions"
DROP INDEX "public"."idx_submissions_committee";
-- reverse: create "submissions" table
DROP TABLE "public"."submissions";
-- reverse: create index "idx_org_submission_settings_org_id" to table: "organization_submission_settings"
DROP INDEX "public"."idx_org_submission_settings_org_id";
-- reverse: create "organization_submission_settings" table
DROP TABLE "public"."organization_submission_settings";
-- reverse: create index "idx_committee_payment_accounts_committee_id" to table: "committee_payment_accounts"
DROP INDEX "public"."idx_committee_payment_accounts_committee_id";
-- reverse: create "committee_payment_accounts" table
DROP TABLE "public"."committee_payment_accounts";
-- reverse: create index "idx_committees_org_id" to table: "committees"
DROP INDEX "public"."idx_committees_org_id";
-- reverse: create index "idx_committees_org_custom_id" to table: "committees"
DROP INDEX "public"."idx_committees_org_custom_id";
-- reverse: create index "idx_committees_display_name" to table: "committees"
DROP INDEX "public"."idx_committees_display_name";
-- reverse: create "committees" table
DROP TABLE "public"."committees";

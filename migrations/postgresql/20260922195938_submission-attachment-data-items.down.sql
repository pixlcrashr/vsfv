-- reverse: create index "idx_submission_attachments_data_item_id" to table: "submission_attachments"
DROP INDEX "public"."idx_submission_attachments_data_item_id";
-- reverse: modify "submission_attachments" table
ALTER TABLE "public"."submission_attachments" DROP CONSTRAINT "fk_submission_attachments_data_item", DROP COLUMN "data_item_id", ADD COLUMN "storage_key" text NOT NULL DEFAULT '', ADD COLUMN "file_size" bigint NOT NULL DEFAULT 0, ADD COLUMN "mime_type" text NOT NULL DEFAULT '', ADD COLUMN "file_name" text NOT NULL DEFAULT '';
-- reverse: create "data_items" table
DROP TABLE "public"."data_items";

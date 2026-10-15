-- create "data_items" table
CREATE TABLE "public"."data_items" (
  "id" uuid NOT NULL,
  "file_name" text NOT NULL DEFAULT '',
  "mime_type" text NOT NULL DEFAULT '',
  "file_size" bigint NOT NULL DEFAULT 0,
  "sha256_sum" character varying(64) NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
-- modify "submission_attachments" table
ALTER TABLE "public"."submission_attachments" DROP COLUMN "file_name", DROP COLUMN "mime_type", DROP COLUMN "file_size", DROP COLUMN "storage_key", ADD COLUMN "data_item_id" uuid NOT NULL, ADD CONSTRAINT "fk_submission_attachments_data_item" FOREIGN KEY ("data_item_id") REFERENCES "public"."data_items" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION;
-- create index "idx_submission_attachments_data_item_id" to table: "submission_attachments"
CREATE INDEX "idx_submission_attachments_data_item_id" ON "public"."submission_attachments" ("data_item_id");

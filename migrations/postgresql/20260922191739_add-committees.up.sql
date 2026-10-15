-- create "committees" table
CREATE TABLE "public"."committees" (
  "id" uuid NOT NULL,
  "custom_id" text NOT NULL,
  "organization_id" uuid NOT NULL,
  "display_name" text NOT NULL DEFAULT '',
  "display_description" text NOT NULL DEFAULT '',
  "allow_scope_selection" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_organizations_committees" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- create index "idx_committees_display_name" to table: "committees"
CREATE INDEX "idx_committees_display_name" ON "public"."committees" ("display_name");
-- create index "idx_committees_org_custom_id" to table: "committees"
CREATE UNIQUE INDEX "idx_committees_org_custom_id" ON "public"."committees" ("custom_id", "organization_id");
-- create index "idx_committees_org_id" to table: "committees"
CREATE UNIQUE INDEX "idx_committees_org_id" ON "public"."committees" ("id", "organization_id");
-- create "committee_payment_accounts" table
CREATE TABLE "public"."committee_payment_accounts" (
  "id" uuid NOT NULL,
  "committee_id" uuid NOT NULL,
  "kind" bigint NOT NULL DEFAULT 0,
  "display_label" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_committees_payment_accounts" FOREIGN KEY ("committee_id") REFERENCES "public"."committees" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- create index "idx_committee_payment_accounts_committee_id" to table: "committee_payment_accounts"
CREATE INDEX "idx_committee_payment_accounts_committee_id" ON "public"."committee_payment_accounts" ("committee_id");
-- create "organization_submission_settings" table
CREATE TABLE "public"."organization_submission_settings" (
  "id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "enabled_settlement_kinds" text[] NULL,
  "submission_deadline" date NULL,
  "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_organizations_submission_settings" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- create index "idx_org_submission_settings_org_id" to table: "organization_submission_settings"
CREATE UNIQUE INDEX "idx_org_submission_settings_org_id" ON "public"."organization_submission_settings" ("organization_id");
-- create "submissions" table
CREATE TABLE "public"."submissions" (
  "id" uuid NOT NULL,
  "custom_id" text NOT NULL,
  "public_id" text NOT NULL DEFAULT '',
  "organization_id" uuid NOT NULL,
  "created_by_user_id" uuid NOT NULL,
  "committee_id" uuid NOT NULL,
  "direction" bigint NOT NULL DEFAULT 0,
  "settlement" bigint NOT NULL DEFAULT 0,
  "scope" bigint NOT NULL DEFAULT 0,
  "status" bigint NOT NULL DEFAULT 0,
  "notice" text NOT NULL DEFAULT '',
  "total_amount" numeric NOT NULL,
  "etag" text NOT NULL DEFAULT '',
  "payout_method" bigint NOT NULL DEFAULT 0,
  "bank_account_holder" text NOT NULL DEFAULT '',
  "bank_iban" text NOT NULL DEFAULT '',
  "bank_bic" text NOT NULL DEFAULT '',
  "payment_account_uid" uuid NULL,
  "payment_account_label" text NOT NULL DEFAULT '',
  "account_paid_date" date NULL,
  "account_payment_reference" text NOT NULL DEFAULT '',
  "vendor_name" text NOT NULL DEFAULT '',
  "vendor_iban" text NOT NULL DEFAULT '',
  "vendor_bic" text NOT NULL DEFAULT '',
  "vendor_timing" bigint NOT NULL DEFAULT 0,
  "completion_paid_date" date NULL,
  "completion_payment_reference" text NOT NULL DEFAULT '',
  "deleted_at" timestamptz NULL,
  "purge_time" timestamptz NULL,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_committees_submissions" FOREIGN KEY ("committee_id") REFERENCES "public"."committees" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_organizations_submissions" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_submissions_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- create index "idx_submissions_committee" to table: "submissions"
CREATE INDEX "idx_submissions_committee" ON "public"."submissions" ("committee_id");
-- create index "idx_submissions_created_by" to table: "submissions"
CREATE INDEX "idx_submissions_created_by" ON "public"."submissions" ("created_by_user_id");
-- create index "idx_submissions_org_custom_id" to table: "submissions"
CREATE UNIQUE INDEX "idx_submissions_org_custom_id" ON "public"."submissions" ("custom_id", "organization_id");
-- create index "idx_submissions_org_id" to table: "submissions"
CREATE UNIQUE INDEX "idx_submissions_org_id" ON "public"."submissions" ("id", "organization_id");
-- create index "idx_submissions_org_public_id" to table: "submissions"
CREATE UNIQUE INDEX "idx_submissions_org_public_id" ON "public"."submissions" ("organization_id", "public_id");
-- create index "idx_submissions_status" to table: "submissions"
CREATE INDEX "idx_submissions_status" ON "public"."submissions" ("status");
-- create "submission_items" table
CREATE TABLE "public"."submission_items" (
  "id" uuid NOT NULL,
  "public_id" text NOT NULL DEFAULT '',
  "submission_id" uuid NOT NULL,
  "category" text NOT NULL DEFAULT '',
  "document_form" bigint NOT NULL DEFAULT 0,
  "source" text NOT NULL DEFAULT '',
  "description" text NOT NULL DEFAULT '',
  "amount" numeric NOT NULL,
  "original_receive_time" timestamptz NULL,
  "original_received_by_user_id" uuid NULL,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_submission_items_original_received_by" FOREIGN KEY ("original_received_by_user_id") REFERENCES "public"."users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_submission_items_submission" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- create index "idx_submission_items_submission_id" to table: "submission_items"
CREATE INDEX "idx_submission_items_submission_id" ON "public"."submission_items" ("submission_id");
-- create index "idx_submission_items_submission_public_id" to table: "submission_items"
CREATE UNIQUE INDEX "idx_submission_items_submission_public_id" ON "public"."submission_items" ("submission_id", "public_id");
-- create "submission_attachments" table
CREATE TABLE "public"."submission_attachments" (
  "id" uuid NOT NULL,
  "submission_item_id" uuid NOT NULL,
  "file_name" text NOT NULL DEFAULT '',
  "mime_type" text NOT NULL DEFAULT '',
  "file_size" bigint NOT NULL DEFAULT 0,
  "storage_key" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_submission_attachments_submission_item" FOREIGN KEY ("submission_item_id") REFERENCES "public"."submission_items" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- create index "idx_submission_attachments_item_id" to table: "submission_attachments"
CREATE INDEX "idx_submission_attachments_item_id" ON "public"."submission_attachments" ("submission_item_id");
-- create index "idx_submission_attachments_storage_key" to table: "submission_attachments"
CREATE UNIQUE INDEX "idx_submission_attachments_storage_key" ON "public"."submission_attachments" ("storage_key");
-- create "submission_comments" table
CREATE TABLE "public"."submission_comments" (
  "id" uuid NOT NULL,
  "submission_id" uuid NOT NULL,
  "author_user_id" uuid NULL,
  "content" text NOT NULL DEFAULT '',
  "is_admin_only" boolean NOT NULL DEFAULT false,
  "status_from" integer NOT NULL DEFAULT 0,
  "status_to" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_submission_comments_author" FOREIGN KEY ("author_user_id") REFERENCES "public"."users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_submission_comments_submission" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- create index "idx_submission_comments_submission_id" to table: "submission_comments"
CREATE INDEX "idx_submission_comments_submission_id" ON "public"."submission_comments" ("submission_id");

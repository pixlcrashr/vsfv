-- backfill "type" and "scope" with the enum zero values (income_expense / none)
-- so existing rows with NULL satisfy the new NOT NULL constraints below
UPDATE "public"."submissions" SET "type" = 0 WHERE "type" IS NULL;
UPDATE "public"."submissions" SET "scope" = 0 WHERE "scope" IS NULL;
-- rename a column from "settlement" to "settlement_type"
ALTER TABLE "public"."submissions" RENAME COLUMN "settlement" TO "settlement_type";
-- rename a column from "payout_method" to "person_payout_method"
ALTER TABLE "public"."submissions" RENAME COLUMN "payout_method" TO "person_payout_method";
-- rename a column from "payment_account_uid" to "committee_payment_account_id"
ALTER TABLE "public"."submissions" RENAME COLUMN "payment_account_uid" TO "committee_payment_account_id";
-- rename a column from "payment_account_label" to "committee_payment_account_label"
ALTER TABLE "public"."submissions" RENAME COLUMN "payment_account_label" TO "committee_payment_account_label";
-- rename a column from "account_paid_date" to "committee_account_paid_date"
ALTER TABLE "public"."submissions" RENAME COLUMN "account_paid_date" TO "committee_account_paid_date";
-- rename a column from "account_payment_reference" to "committee_account_payment_reference"
ALTER TABLE "public"."submissions" RENAME COLUMN "account_payment_reference" TO "committee_account_payment_reference";
-- modify "submissions" table
ALTER TABLE "public"."submissions" ALTER COLUMN "scope" SET NOT NULL, ALTER COLUMN "type" SET NOT NULL;

-- reverse: modify "submissions" table
ALTER TABLE "public"."submissions" ALTER COLUMN "type" DROP NOT NULL, ALTER COLUMN "scope" DROP NOT NULL;
-- reverse: rename a column from "account_payment_reference" to "committee_account_payment_reference"
ALTER TABLE "public"."submissions" RENAME COLUMN "committee_account_payment_reference" TO "account_payment_reference";
-- reverse: rename a column from "account_paid_date" to "committee_account_paid_date"
ALTER TABLE "public"."submissions" RENAME COLUMN "committee_account_paid_date" TO "account_paid_date";
-- reverse: rename a column from "payment_account_label" to "committee_payment_account_label"
ALTER TABLE "public"."submissions" RENAME COLUMN "committee_payment_account_label" TO "payment_account_label";
-- reverse: rename a column from "payment_account_uid" to "committee_payment_account_id"
ALTER TABLE "public"."submissions" RENAME COLUMN "committee_payment_account_id" TO "payment_account_uid";
-- reverse: rename a column from "payout_method" to "person_payout_method"
ALTER TABLE "public"."submissions" RENAME COLUMN "person_payout_method" TO "payout_method";
-- reverse: rename a column from "settlement" to "settlement_type"
ALTER TABLE "public"."submissions" RENAME COLUMN "settlement_type" TO "settlement";

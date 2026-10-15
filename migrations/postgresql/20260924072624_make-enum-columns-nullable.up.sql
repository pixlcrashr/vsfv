-- modify "committee_payment_accounts" table
ALTER TABLE "public"."committee_payment_accounts" ALTER COLUMN "kind" DROP DEFAULT;
-- modify "ledger_accounts" table
ALTER TABLE "public"."ledger_accounts" ALTER COLUMN "account_type" DROP NOT NULL, ALTER COLUMN "account_type" DROP DEFAULT;
-- modify "submission_items" table
ALTER TABLE "public"."submission_items" ALTER COLUMN "document_form" DROP NOT NULL, ALTER COLUMN "document_form" DROP DEFAULT;
-- modify "submissions" table
ALTER TABLE "public"."submissions" ALTER COLUMN "direction" DROP DEFAULT, ALTER COLUMN "settlement" DROP NOT NULL, ALTER COLUMN "settlement" DROP DEFAULT, ALTER COLUMN "scope" DROP DEFAULT, ALTER COLUMN "status" DROP DEFAULT, ALTER COLUMN "payout_method" DROP NOT NULL, ALTER COLUMN "payout_method" DROP DEFAULT, ALTER COLUMN "vendor_timing" DROP NOT NULL, ALTER COLUMN "vendor_timing" DROP DEFAULT;

-- reverse: modify "submissions" table
ALTER TABLE "public"."submissions" ALTER COLUMN "vendor_timing" SET NOT NULL, ALTER COLUMN "vendor_timing" SET DEFAULT 0, ALTER COLUMN "payout_method" SET NOT NULL, ALTER COLUMN "payout_method" SET DEFAULT 0, ALTER COLUMN "status" SET DEFAULT 0, ALTER COLUMN "scope" SET DEFAULT 0, ALTER COLUMN "settlement" SET NOT NULL, ALTER COLUMN "settlement" SET DEFAULT 0, ALTER COLUMN "direction" SET DEFAULT 0;
-- reverse: modify "submission_items" table
ALTER TABLE "public"."submission_items" ALTER COLUMN "document_form" SET NOT NULL, ALTER COLUMN "document_form" SET DEFAULT 0;
-- reverse: modify "ledger_accounts" table
ALTER TABLE "public"."ledger_accounts" ALTER COLUMN "account_type" SET NOT NULL, ALTER COLUMN "account_type" SET DEFAULT 0;
-- reverse: modify "committee_payment_accounts" table
ALTER TABLE "public"."committee_payment_accounts" ALTER COLUMN "kind" SET DEFAULT 0;

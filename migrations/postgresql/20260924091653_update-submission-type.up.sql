-- modify "submissions" table
ALTER TABLE "public"."submissions" ALTER COLUMN "scope" DROP NOT NULL, DROP COLUMN "vendor_timing", ADD COLUMN "bank_account_number" text NOT NULL DEFAULT '', ADD COLUMN "vendor_account_number" text NOT NULL DEFAULT '';

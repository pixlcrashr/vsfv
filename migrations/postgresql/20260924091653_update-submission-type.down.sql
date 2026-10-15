-- reverse: modify "submissions" table
ALTER TABLE "public"."submissions" DROP COLUMN "vendor_account_number", DROP COLUMN "bank_account_number", ADD COLUMN "vendor_timing" bigint NULL, ALTER COLUMN "scope" SET NOT NULL;

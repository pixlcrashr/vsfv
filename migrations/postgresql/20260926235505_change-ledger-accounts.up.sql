-- modify "accounts" table
ALTER TABLE "public"."accounts" ADD COLUMN "invert_sign" boolean NOT NULL DEFAULT false;
-- rename a column from "account_type" to "type"
ALTER TABLE "public"."ledger_accounts" RENAME COLUMN "account_type" TO "type";

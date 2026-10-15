-- reverse: rename a column from "account_type" to "type"
ALTER TABLE "public"."ledger_accounts" RENAME COLUMN "type" TO "account_type";
-- reverse: modify "accounts" table
ALTER TABLE "public"."accounts" DROP COLUMN "invert_sign";

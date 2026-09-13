-- reverse: create index "idx_transactions_journal_key_org" to table: "transactions"
DROP INDEX "public"."idx_transactions_journal_key_org";
-- reverse: modify "transactions" table
ALTER TABLE "public"."transactions" DROP COLUMN "journal_key";

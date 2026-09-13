-- reverse: create index "idx_transactions_journal_key_org" to table: "transactions"
DROP INDEX `idx_transactions_journal_key_org`;
-- reverse: add column "journal_key" to table: "transactions"
ALTER TABLE `transactions` DROP COLUMN `journal_key`;

-- Add journal_key column with a default so existing rows get a value.
-- SQLite does not support ALTER COLUMN ... SET NOT NULL, so the column is
-- added as NOT NULL DEFAULT '' and then backfilled.
ALTER TABLE `transactions` ADD COLUMN `journal_key` text NOT NULL DEFAULT '';

-- Backfill journal_key from transaction fields and reset custom_id to the PK id.
-- The journal_key format is: v1:booked_at:document_date:credit_code:debit_code:amount:reference:description
UPDATE transactions
SET journal_key =
      'v1:' || date(booked_at) || ':' || date(document_date) || ':' ||
             (SELECT code FROM ledger_accounts WHERE id = transactions.credit_ledger_account_id) || ':' ||
             (SELECT code FROM ledger_accounts WHERE id = transactions.debit_ledger_account_id) || ':' ||
             amount || ':' || reference || ':' || description,
      custom_id = id
WHERE journal_key = '';

-- Fallback for any orphaned transactions whose ledger accounts no longer exist.
UPDATE transactions SET journal_key = 'v1:orphan:' || id WHERE journal_key = '' OR journal_key IS NULL;

-- Create unique index after backfill to avoid conflicts.
CREATE UNIQUE INDEX `idx_transactions_journal_key_org` ON `transactions` (`journal_key`, `organization_id`);

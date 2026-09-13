-- Add journal_key as nullable first so existing rows don't violate NOT NULL.
ALTER TABLE "public"."transactions" ADD COLUMN "journal_key" text;

-- Backfill journal_key from transaction fields and reset custom_id to the PK id.
-- The journal_key format is: v1:booked_at:document_date:credit_code:debit_code:amount:reference:description
UPDATE transactions t
SET journal_key =
      'v1:' || to_char(t.booked_at,     'YYYY-MM-DD') || ':' ||
               to_char(t.document_date, 'YYYY-MM-DD') || ':' ||
               la_credit.code || ':' || la_debit.code || ':' ||
               regexp_replace(regexp_replace(
                  to_char(t.amount, 'FM999999999999990.00'), '0+$', ''), '\.$', '') ||
               ':' || t.reference || ':' || t.description,
      custom_id = t.id::text
FROM ledger_accounts la_credit, ledger_accounts la_debit
WHERE la_credit.id = t.credit_ledger_account_id
  AND la_debit.id  = t.debit_ledger_account_id;

-- Fallback for any orphaned transactions whose ledger accounts no longer exist.
UPDATE transactions SET journal_key = 'v1:orphan:' || id::text WHERE journal_key IS NULL;

-- Enforce NOT NULL after backfill.
ALTER TABLE "public"."transactions" ALTER COLUMN "journal_key" SET NOT NULL;

-- Create unique index after backfill to avoid conflicts.
CREATE UNIQUE INDEX "idx_transactions_journal_key_org" ON "public"."transactions" ("journal_key", "organization_id");

-- Create missing import_source_periods for existing transactions
-- This migration creates import_source_periods for each unique year found in transactions.document_date
-- for the corresponding import source (derived from transaction_accounts)

INSERT INTO "import_source_periods" ("import_source_id", "year", "is_closed", "created_at", "updated_at")
SELECT DISTINCT
    ta.import_source_id,
    EXTRACT(YEAR FROM t.document_date)::integer AS year,
    false AS is_closed,
    CURRENT_TIMESTAMP AS created_at,
    CURRENT_TIMESTAMP AS updated_at
FROM "transactions" t
JOIN "transaction_accounts" ta ON t.credit_transaction_account_id = ta.id
WHERE NOT EXISTS (
    SELECT 1 FROM "import_source_periods" isp
    WHERE isp.import_source_id = ta.import_source_id
    AND isp.year = EXTRACT(YEAR FROM t.document_date)::integer
);

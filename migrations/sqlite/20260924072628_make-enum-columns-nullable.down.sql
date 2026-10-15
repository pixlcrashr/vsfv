-- reverse: create index "idx_submission_items_submission_public_id" to table: "submission_items"
DROP INDEX `idx_submission_items_submission_public_id`;
-- reverse: create index "idx_submission_items_submission_id" to table: "submission_items"
DROP INDEX `idx_submission_items_submission_id`;
-- reverse: create "new_submission_items" table
DROP TABLE `new_submission_items`;
-- reverse: create index "idx_submissions_org_id" to table: "submissions"
DROP INDEX `idx_submissions_org_id`;
-- reverse: create index "idx_submissions_org_custom_id" to table: "submissions"
DROP INDEX `idx_submissions_org_custom_id`;
-- reverse: create index "idx_submissions_org_public_id" to table: "submissions"
DROP INDEX `idx_submissions_org_public_id`;
-- reverse: create index "idx_submissions_created_by" to table: "submissions"
DROP INDEX `idx_submissions_created_by`;
-- reverse: create index "idx_submissions_committee" to table: "submissions"
DROP INDEX `idx_submissions_committee`;
-- reverse: create index "idx_submissions_status" to table: "submissions"
DROP INDEX `idx_submissions_status`;
-- reverse: create "new_submissions" table
DROP TABLE `new_submissions`;
-- reverse: create index "idx_committee_payment_accounts_committee_id" to table: "committee_payment_accounts"
DROP INDEX `idx_committee_payment_accounts_committee_id`;
-- reverse: create "new_committee_payment_accounts" table
DROP TABLE `new_committee_payment_accounts`;
-- reverse: create index "idx_ledger_accounts_org_id" to table: "ledger_accounts"
DROP INDEX `idx_ledger_accounts_org_id`;
-- reverse: create index "idx_ledger_accounts_custom_id" to table: "ledger_accounts"
DROP INDEX `idx_ledger_accounts_custom_id`;
-- reverse: create index "idx_ledger_accounts_org_code" to table: "ledger_accounts"
DROP INDEX `idx_ledger_accounts_org_code`;
-- reverse: create index "idx_ledger_accounts_code" to table: "ledger_accounts"
DROP INDEX `idx_ledger_accounts_code`;
-- reverse: create index "idx_ledger_accounts_display_name" to table: "ledger_accounts"
DROP INDEX `idx_ledger_accounts_display_name`;
-- reverse: create "new_ledger_accounts" table
DROP TABLE `new_ledger_accounts`;

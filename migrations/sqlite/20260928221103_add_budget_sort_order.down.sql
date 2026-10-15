-- reverse: create index "idx_budgets_org_order" to table: "budgets"
DROP INDEX `idx_budgets_org_order`;
-- reverse: add column "sort_order" to table: "budgets"
ALTER TABLE `budgets` DROP COLUMN `sort_order`;

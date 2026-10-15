-- add column "sort_order" to table: "budgets"
ALTER TABLE `budgets` ADD COLUMN `sort_order` integer NOT NULL DEFAULT 0;
-- create index "idx_budgets_org_order" to table: "budgets"
CREATE INDEX `idx_budgets_org_order` ON `budgets` (`organization_id`, `sort_order`);

-- reverse: create index "idx_budgets_org_order" to table: "budgets"
DROP INDEX "public"."idx_budgets_org_order";
-- reverse: modify "budgets" table
ALTER TABLE "public"."budgets" DROP COLUMN "sort_order";

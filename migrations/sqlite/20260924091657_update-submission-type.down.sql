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

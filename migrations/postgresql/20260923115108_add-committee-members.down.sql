-- reverse: create index "idx_committee_members_user_id" to table: "committee_members"
DROP INDEX "public"."idx_committee_members_user_id";
-- reverse: create index "idx_committee_members_committee_user" to table: "committee_members"
DROP INDEX "public"."idx_committee_members_committee_user";
-- reverse: create index "idx_committee_members_committee_id" to table: "committee_members"
DROP INDEX "public"."idx_committee_members_committee_id";
-- reverse: create "committee_members" table
DROP TABLE "public"."committee_members";

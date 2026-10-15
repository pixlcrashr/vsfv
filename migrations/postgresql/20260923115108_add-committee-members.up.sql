-- create "committee_members" table
CREATE TABLE "public"."committee_members" (
  "id" uuid NOT NULL,
  "committee_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "fk_committee_members_committee" FOREIGN KEY ("committee_id") REFERENCES "public"."committees" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT "fk_committee_members_user" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- create index "idx_committee_members_committee_id" to table: "committee_members"
CREATE INDEX "idx_committee_members_committee_id" ON "public"."committee_members" ("committee_id");
-- create index "idx_committee_members_committee_user" to table: "committee_members"
CREATE UNIQUE INDEX "idx_committee_members_committee_user" ON "public"."committee_members" ("committee_id", "user_id");
-- create index "idx_committee_members_user_id" to table: "committee_members"
CREATE INDEX "idx_committee_members_user_id" ON "public"."committee_members" ("user_id");

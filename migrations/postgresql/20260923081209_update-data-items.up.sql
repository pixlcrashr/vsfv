-- create "submission_sequences" table
CREATE TABLE "public"."submission_sequences" (
  "organization_id" uuid NOT NULL,
  "year" bigint NOT NULL,
  "next_value" bigint NOT NULL,
  PRIMARY KEY ("organization_id", "year")
);

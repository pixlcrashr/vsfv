-- reverse: modify "submissions" table
ALTER TABLE "public"."submissions" ADD COLUMN "etag" text NOT NULL DEFAULT '';

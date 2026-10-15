-- create "submission_sequences" table
CREATE TABLE `submission_sequences` (
  `organization_id` uuid NULL,
  `year` integer NULL,
  `next_value` integer NOT NULL,
  PRIMARY KEY (`organization_id`, `year`)
);

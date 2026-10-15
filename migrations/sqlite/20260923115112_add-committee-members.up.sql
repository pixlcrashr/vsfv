-- create "committee_members" table
CREATE TABLE `committee_members` (
  `id` uuid NULL,
  `committee_id` uuid NOT NULL,
  `user_id` uuid NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_committee_members_committee` FOREIGN KEY (`committee_id`) REFERENCES `committees` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT `fk_committee_members_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- create index "idx_committee_members_user_id" to table: "committee_members"
CREATE INDEX `idx_committee_members_user_id` ON `committee_members` (`user_id`);
-- create index "idx_committee_members_committee_id" to table: "committee_members"
CREATE INDEX `idx_committee_members_committee_id` ON `committee_members` (`committee_id`);
-- create index "idx_committee_members_committee_user" to table: "committee_members"
CREATE UNIQUE INDEX `idx_committee_members_committee_user` ON `committee_members` (`committee_id`, `user_id`);

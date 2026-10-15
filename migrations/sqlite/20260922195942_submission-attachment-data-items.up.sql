-- disable the enforcement of foreign-keys constraints
PRAGMA foreign_keys = off;
-- create "new_submission_attachments" table
CREATE TABLE `new_submission_attachments` (
  `id` uuid NULL,
  `submission_item_id` uuid NOT NULL,
  `data_item_id` uuid NOT NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_submission_attachments_submission_item` FOREIGN KEY (`submission_item_id`) REFERENCES `submission_items` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT `fk_submission_attachments_data_item` FOREIGN KEY (`data_item_id`) REFERENCES `data_items` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- copy rows from old table "submission_attachments" to new temporary table "new_submission_attachments"
INSERT INTO `new_submission_attachments` (`id`, `submission_item_id`, `created_at`) SELECT `id`, `submission_item_id`, `created_at` FROM `submission_attachments`;
-- drop "submission_attachments" table after copying rows
DROP TABLE `submission_attachments`;
-- rename temporary table "new_submission_attachments" to "submission_attachments"
ALTER TABLE `new_submission_attachments` RENAME TO `submission_attachments`;
-- create index "idx_submission_attachments_data_item_id" to table: "submission_attachments"
CREATE INDEX `idx_submission_attachments_data_item_id` ON `submission_attachments` (`data_item_id`);
-- create index "idx_submission_attachments_item_id" to table: "submission_attachments"
CREATE INDEX `idx_submission_attachments_item_id` ON `submission_attachments` (`submission_item_id`);
-- create "data_items" table
CREATE TABLE `data_items` (
  `id` uuid NULL,
  `file_name` text NOT NULL DEFAULT '',
  `mime_type` text NOT NULL DEFAULT '',
  `file_size` integer NOT NULL DEFAULT 0,
  `sha256_sum` varchar NOT NULL DEFAULT '',
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`)
);
-- enable back the enforcement of foreign-keys constraints
PRAGMA foreign_keys = on;

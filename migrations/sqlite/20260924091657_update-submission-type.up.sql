-- disable the enforcement of foreign-keys constraints
PRAGMA foreign_keys = off;
-- create "new_submissions" table
CREATE TABLE `new_submissions` (
  `id` uuid NULL,
  `custom_id` text NOT NULL,
  `public_id` text NOT NULL DEFAULT '',
  `organization_id` uuid NOT NULL,
  `created_by_user_id` uuid NOT NULL,
  `committee_id` uuid NOT NULL,
  `direction` integer NOT NULL,
  `settlement` integer NULL,
  `scope` integer NULL,
  `status` integer NOT NULL,
  `notice` text NOT NULL DEFAULT '',
  `total_amount` decimal NOT NULL,
  `etag` text NOT NULL DEFAULT '',
  `payout_method` integer NULL,
  `bank_account_holder` text NOT NULL DEFAULT '',
  `bank_iban` text NOT NULL DEFAULT '',
  `bank_bic` text NOT NULL DEFAULT '',
  `bank_account_number` text NOT NULL DEFAULT '',
  `payment_account_uid` uuid NULL,
  `payment_account_label` text NOT NULL DEFAULT '',
  `account_paid_date` date NULL,
  `account_payment_reference` text NOT NULL DEFAULT '',
  `vendor_name` text NOT NULL DEFAULT '',
  `vendor_iban` text NOT NULL DEFAULT '',
  `vendor_bic` text NOT NULL DEFAULT '',
  `vendor_account_number` text NOT NULL DEFAULT '',
  `completion_paid_date` date NULL,
  `completion_payment_reference` text NOT NULL DEFAULT '',
  `deleted_at` datetime NULL,
  `purge_time` datetime NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_organizations_submissions` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT `fk_committees_submissions` FOREIGN KEY (`committee_id`) REFERENCES `committees` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT `fk_submissions_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- copy rows from old table "submissions" to new temporary table "new_submissions"
INSERT INTO `new_submissions` (`id`, `custom_id`, `public_id`, `organization_id`, `created_by_user_id`, `committee_id`, `direction`, `settlement`, `scope`, `status`, `notice`, `total_amount`, `etag`, `payout_method`, `bank_account_holder`, `bank_iban`, `bank_bic`, `payment_account_uid`, `payment_account_label`, `account_paid_date`, `account_payment_reference`, `vendor_name`, `vendor_iban`, `vendor_bic`, `completion_paid_date`, `completion_payment_reference`, `deleted_at`, `purge_time`, `created_at`, `updated_at`) SELECT `id`, `custom_id`, `public_id`, `organization_id`, `created_by_user_id`, `committee_id`, `direction`, `settlement`, `scope`, `status`, `notice`, `total_amount`, `etag`, `payout_method`, `bank_account_holder`, `bank_iban`, `bank_bic`, `payment_account_uid`, `payment_account_label`, `account_paid_date`, `account_payment_reference`, `vendor_name`, `vendor_iban`, `vendor_bic`, `completion_paid_date`, `completion_payment_reference`, `deleted_at`, `purge_time`, `created_at`, `updated_at` FROM `submissions`;
-- drop "submissions" table after copying rows
DROP TABLE `submissions`;
-- rename temporary table "new_submissions" to "submissions"
ALTER TABLE `new_submissions` RENAME TO `submissions`;
-- create index "idx_submissions_status" to table: "submissions"
CREATE INDEX `idx_submissions_status` ON `submissions` (`status`);
-- create index "idx_submissions_committee" to table: "submissions"
CREATE INDEX `idx_submissions_committee` ON `submissions` (`committee_id`);
-- create index "idx_submissions_created_by" to table: "submissions"
CREATE INDEX `idx_submissions_created_by` ON `submissions` (`created_by_user_id`);
-- create index "idx_submissions_org_public_id" to table: "submissions"
CREATE UNIQUE INDEX `idx_submissions_org_public_id` ON `submissions` (`organization_id`, `public_id`);
-- create index "idx_submissions_org_custom_id" to table: "submissions"
CREATE UNIQUE INDEX `idx_submissions_org_custom_id` ON `submissions` (`custom_id`, `organization_id`);
-- create index "idx_submissions_org_id" to table: "submissions"
CREATE UNIQUE INDEX `idx_submissions_org_id` ON `submissions` (`id`, `organization_id`);
-- enable back the enforcement of foreign-keys constraints
PRAGMA foreign_keys = on;

-- disable the enforcement of foreign-keys constraints
PRAGMA foreign_keys = off;
-- create "new_ledger_accounts" table
CREATE TABLE `new_ledger_accounts` (
  `id` uuid NULL,
  `custom_id` text NULL,
  `organization_id` uuid NOT NULL,
  `code` varchar NOT NULL,
  `account_type` integer NULL,
  `display_name` text NOT NULL DEFAULT '',
  `display_description` text NOT NULL DEFAULT '',
  `updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_organizations_ledger_accounts` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- copy rows from old table "ledger_accounts" to new temporary table "new_ledger_accounts"
INSERT INTO `new_ledger_accounts` (`id`, `custom_id`, `organization_id`, `code`, `account_type`, `display_name`, `display_description`, `updated_at`, `created_at`) SELECT `id`, `custom_id`, `organization_id`, `code`, `account_type`, `display_name`, `display_description`, `updated_at`, `created_at` FROM `ledger_accounts`;
-- drop "ledger_accounts" table after copying rows
DROP TABLE `ledger_accounts`;
-- rename temporary table "new_ledger_accounts" to "ledger_accounts"
ALTER TABLE `new_ledger_accounts` RENAME TO `ledger_accounts`;
-- create index "idx_ledger_accounts_display_name" to table: "ledger_accounts"
CREATE INDEX `idx_ledger_accounts_display_name` ON `ledger_accounts` (`display_name`);
-- create index "idx_ledger_accounts_code" to table: "ledger_accounts"
CREATE INDEX `idx_ledger_accounts_code` ON `ledger_accounts` (`code`);
-- create index "idx_ledger_accounts_org_code" to table: "ledger_accounts"
CREATE UNIQUE INDEX `idx_ledger_accounts_org_code` ON `ledger_accounts` (`organization_id`, `code`);
-- create index "idx_ledger_accounts_custom_id" to table: "ledger_accounts"
CREATE UNIQUE INDEX `idx_ledger_accounts_custom_id` ON `ledger_accounts` (`custom_id`, `organization_id`);
-- create index "idx_ledger_accounts_org_id" to table: "ledger_accounts"
CREATE UNIQUE INDEX `idx_ledger_accounts_org_id` ON `ledger_accounts` (`id`, `organization_id`);
-- create "new_committee_payment_accounts" table
CREATE TABLE `new_committee_payment_accounts` (
  `id` uuid NULL,
  `committee_id` uuid NOT NULL,
  `kind` integer NOT NULL,
  `display_label` text NOT NULL DEFAULT '',
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_committees_payment_accounts` FOREIGN KEY (`committee_id`) REFERENCES `committees` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- copy rows from old table "committee_payment_accounts" to new temporary table "new_committee_payment_accounts"
INSERT INTO `new_committee_payment_accounts` (`id`, `committee_id`, `kind`, `display_label`, `created_at`) SELECT `id`, `committee_id`, `kind`, `display_label`, `created_at` FROM `committee_payment_accounts`;
-- drop "committee_payment_accounts" table after copying rows
DROP TABLE `committee_payment_accounts`;
-- rename temporary table "new_committee_payment_accounts" to "committee_payment_accounts"
ALTER TABLE `new_committee_payment_accounts` RENAME TO `committee_payment_accounts`;
-- create index "idx_committee_payment_accounts_committee_id" to table: "committee_payment_accounts"
CREATE INDEX `idx_committee_payment_accounts_committee_id` ON `committee_payment_accounts` (`committee_id`);
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
  `scope` integer NOT NULL,
  `status` integer NOT NULL,
  `notice` text NOT NULL DEFAULT '',
  `total_amount` decimal NOT NULL,
  `etag` text NOT NULL DEFAULT '',
  `payout_method` integer NULL,
  `bank_account_holder` text NOT NULL DEFAULT '',
  `bank_iban` text NOT NULL DEFAULT '',
  `bank_bic` text NOT NULL DEFAULT '',
  `payment_account_uid` uuid NULL,
  `payment_account_label` text NOT NULL DEFAULT '',
  `account_paid_date` date NULL,
  `account_payment_reference` text NOT NULL DEFAULT '',
  `vendor_name` text NOT NULL DEFAULT '',
  `vendor_iban` text NOT NULL DEFAULT '',
  `vendor_bic` text NOT NULL DEFAULT '',
  `vendor_timing` integer NULL,
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
INSERT INTO `new_submissions` (`id`, `custom_id`, `public_id`, `organization_id`, `created_by_user_id`, `committee_id`, `direction`, `settlement`, `scope`, `status`, `notice`, `total_amount`, `etag`, `payout_method`, `bank_account_holder`, `bank_iban`, `bank_bic`, `payment_account_uid`, `payment_account_label`, `account_paid_date`, `account_payment_reference`, `vendor_name`, `vendor_iban`, `vendor_bic`, `vendor_timing`, `completion_paid_date`, `completion_payment_reference`, `deleted_at`, `purge_time`, `created_at`, `updated_at`) SELECT `id`, `custom_id`, `public_id`, `organization_id`, `created_by_user_id`, `committee_id`, `direction`, `settlement`, `scope`, `status`, `notice`, `total_amount`, `etag`, `payout_method`, `bank_account_holder`, `bank_iban`, `bank_bic`, `payment_account_uid`, `payment_account_label`, `account_paid_date`, `account_payment_reference`, `vendor_name`, `vendor_iban`, `vendor_bic`, `vendor_timing`, `completion_paid_date`, `completion_payment_reference`, `deleted_at`, `purge_time`, `created_at`, `updated_at` FROM `submissions`;
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
-- create "new_submission_items" table
CREATE TABLE `new_submission_items` (
  `id` uuid NULL,
  `public_id` text NOT NULL DEFAULT '',
  `submission_id` uuid NOT NULL,
  `category` text NOT NULL DEFAULT '',
  `document_form` integer NULL,
  `source` text NOT NULL DEFAULT '',
  `description` text NOT NULL DEFAULT '',
  `amount` decimal NOT NULL,
  `original_receive_time` datetime NULL,
  `original_received_by_user_id` uuid NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_submission_items_original_received_by` FOREIGN KEY (`original_received_by_user_id`) REFERENCES `users` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT `fk_submission_items_submission` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- copy rows from old table "submission_items" to new temporary table "new_submission_items"
INSERT INTO `new_submission_items` (`id`, `public_id`, `submission_id`, `category`, `document_form`, `source`, `description`, `amount`, `original_receive_time`, `original_received_by_user_id`, `created_at`, `updated_at`) SELECT `id`, `public_id`, `submission_id`, `category`, `document_form`, `source`, `description`, `amount`, `original_receive_time`, `original_received_by_user_id`, `created_at`, `updated_at` FROM `submission_items`;
-- drop "submission_items" table after copying rows
DROP TABLE `submission_items`;
-- rename temporary table "new_submission_items" to "submission_items"
ALTER TABLE `new_submission_items` RENAME TO `submission_items`;
-- create index "idx_submission_items_submission_id" to table: "submission_items"
CREATE INDEX `idx_submission_items_submission_id` ON `submission_items` (`submission_id`);
-- create index "idx_submission_items_submission_public_id" to table: "submission_items"
CREATE UNIQUE INDEX `idx_submission_items_submission_public_id` ON `submission_items` (`submission_id`, `public_id`);
-- enable back the enforcement of foreign-keys constraints
PRAGMA foreign_keys = on;

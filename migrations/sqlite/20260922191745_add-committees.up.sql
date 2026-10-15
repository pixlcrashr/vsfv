-- disable the enforcement of foreign-keys constraints
PRAGMA foreign_keys = off;
-- create "new_transactions" table
CREATE TABLE `new_transactions` (
  `id` uuid NULL,
  `custom_id` text NULL,
  `journal_key` text NOT NULL,
  `organization_id` uuid NOT NULL,
  `credit_ledger_account_id` uuid NOT NULL,
  `debit_ledger_account_id` uuid NOT NULL,
  `amount` decimal NOT NULL,
  `description` text NOT NULL DEFAULT '',
  `reference` text NOT NULL DEFAULT '',
  `booked_at` date NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `document_date` date NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_ledger_accounts_debit_transactions` FOREIGN KEY (`debit_ledger_account_id`) REFERENCES `ledger_accounts` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT `fk_ledger_accounts_credit_transactions` FOREIGN KEY (`credit_ledger_account_id`) REFERENCES `ledger_accounts` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT `fk_organizations_transactions` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- copy rows from old table "transactions" to new temporary table "new_transactions"
INSERT INTO `new_transactions` (`id`, `custom_id`, `journal_key`, `organization_id`, `credit_ledger_account_id`, `debit_ledger_account_id`, `amount`, `description`, `reference`, `booked_at`, `document_date`, `updated_at`, `created_at`) SELECT `id`, `custom_id`, `journal_key`, `organization_id`, `credit_ledger_account_id`, `debit_ledger_account_id`, `amount`, `description`, `reference`, `booked_at`, `document_date`, `updated_at`, `created_at` FROM `transactions`;
-- drop "transactions" table after copying rows
DROP TABLE `transactions`;
-- rename temporary table "new_transactions" to "transactions"
ALTER TABLE `new_transactions` RENAME TO `transactions`;
-- create index "idx_transactions_unique_entry" to table: "transactions"
CREATE UNIQUE INDEX `idx_transactions_unique_entry` ON `transactions` (`credit_ledger_account_id`, `debit_ledger_account_id`, `amount`, `description`, `reference`, `booked_at`, `document_date`);
-- create index "idx_transactions_journal_key_org" to table: "transactions"
CREATE UNIQUE INDEX `idx_transactions_journal_key_org` ON `transactions` (`journal_key`, `organization_id`);
-- create index "idx_transactions_custom_id_org" to table: "transactions"
CREATE UNIQUE INDEX `idx_transactions_custom_id_org` ON `transactions` (`custom_id`, `organization_id`);
-- create index "idx_transactions_org_id" to table: "transactions"
CREATE UNIQUE INDEX `idx_transactions_org_id` ON `transactions` (`id`, `organization_id`);
-- create "committees" table
CREATE TABLE `committees` (
  `id` uuid NULL,
  `custom_id` text NOT NULL,
  `organization_id` uuid NOT NULL,
  `display_name` text NOT NULL DEFAULT '',
  `display_description` text NOT NULL DEFAULT '',
  `allow_scope_selection` numeric NOT NULL DEFAULT false,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_organizations_committees` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- create index "idx_committees_display_name" to table: "committees"
CREATE INDEX `idx_committees_display_name` ON `committees` (`display_name`);
-- create index "idx_committees_org_custom_id" to table: "committees"
CREATE UNIQUE INDEX `idx_committees_org_custom_id` ON `committees` (`custom_id`, `organization_id`);
-- create index "idx_committees_org_id" to table: "committees"
CREATE UNIQUE INDEX `idx_committees_org_id` ON `committees` (`id`, `organization_id`);
-- create "committee_payment_accounts" table
CREATE TABLE `committee_payment_accounts` (
  `id` uuid NULL,
  `committee_id` uuid NOT NULL,
  `kind` integer NOT NULL DEFAULT 0,
  `display_label` text NOT NULL DEFAULT '',
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_committees_payment_accounts` FOREIGN KEY (`committee_id`) REFERENCES `committees` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- create index "idx_committee_payment_accounts_committee_id" to table: "committee_payment_accounts"
CREATE INDEX `idx_committee_payment_accounts_committee_id` ON `committee_payment_accounts` (`committee_id`);
-- create "submissions" table
CREATE TABLE `submissions` (
  `id` uuid NULL,
  `custom_id` text NOT NULL,
  `public_id` text NOT NULL DEFAULT '',
  `organization_id` uuid NOT NULL,
  `created_by_user_id` uuid NOT NULL,
  `committee_id` uuid NOT NULL,
  `direction` integer NOT NULL DEFAULT 0,
  `settlement` integer NOT NULL DEFAULT 0,
  `scope` integer NOT NULL DEFAULT 0,
  `status` integer NOT NULL DEFAULT 0,
  `notice` text NOT NULL DEFAULT '',
  `total_amount` decimal NOT NULL,
  `etag` text NOT NULL DEFAULT '',
  `payout_method` integer NOT NULL DEFAULT 0,
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
  `vendor_timing` integer NOT NULL DEFAULT 0,
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
-- create "submission_items" table
CREATE TABLE `submission_items` (
  `id` uuid NULL,
  `public_id` text NOT NULL DEFAULT '',
  `submission_id` uuid NOT NULL,
  `category` text NOT NULL DEFAULT '',
  `document_form` integer NOT NULL DEFAULT 0,
  `source` text NOT NULL DEFAULT '',
  `description` text NOT NULL DEFAULT '',
  `amount` decimal NOT NULL,
  `original_receive_time` datetime NULL,
  `original_received_by_user_id` uuid NULL,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  `updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_submission_items_submission` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT `fk_submission_items_original_received_by` FOREIGN KEY (`original_received_by_user_id`) REFERENCES `users` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- create index "idx_submission_items_submission_id" to table: "submission_items"
CREATE INDEX `idx_submission_items_submission_id` ON `submission_items` (`submission_id`);
-- create index "idx_submission_items_submission_public_id" to table: "submission_items"
CREATE UNIQUE INDEX `idx_submission_items_submission_public_id` ON `submission_items` (`submission_id`, `public_id`);
-- create "submission_attachments" table
CREATE TABLE `submission_attachments` (
  `id` uuid NULL,
  `submission_item_id` uuid NOT NULL,
  `file_name` text NOT NULL DEFAULT '',
  `mime_type` text NOT NULL DEFAULT '',
  `file_size` integer NOT NULL DEFAULT 0,
  `storage_key` text NOT NULL DEFAULT '',
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_submission_attachments_submission_item` FOREIGN KEY (`submission_item_id`) REFERENCES `submission_items` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- create index "idx_submission_attachments_storage_key" to table: "submission_attachments"
CREATE UNIQUE INDEX `idx_submission_attachments_storage_key` ON `submission_attachments` (`storage_key`);
-- create index "idx_submission_attachments_item_id" to table: "submission_attachments"
CREATE INDEX `idx_submission_attachments_item_id` ON `submission_attachments` (`submission_item_id`);
-- create "submission_comments" table
CREATE TABLE `submission_comments` (
  `id` uuid NULL,
  `submission_id` uuid NOT NULL,
  `author_user_id` uuid NULL,
  `content` text NOT NULL DEFAULT '',
  `is_admin_only` numeric NOT NULL DEFAULT false,
  `status_from` integer NOT NULL DEFAULT 0,
  `status_to` integer NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_submission_comments_author` FOREIGN KEY (`author_user_id`) REFERENCES `users` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT `fk_submission_comments_submission` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- create index "idx_submission_comments_submission_id" to table: "submission_comments"
CREATE INDEX `idx_submission_comments_submission_id` ON `submission_comments` (`submission_id`);
-- create "organization_submission_settings" table
CREATE TABLE `organization_submission_settings` (
  `id` uuid NULL,
  `organization_id` uuid NOT NULL,
  `enabled_settlement_kinds` text[] NULL,
  `submission_deadline` date NULL,
  `updated_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_organizations_submission_settings` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON UPDATE NO ACTION ON DELETE NO ACTION
);
-- create index "idx_org_submission_settings_org_id" to table: "organization_submission_settings"
CREATE UNIQUE INDEX `idx_org_submission_settings_org_id` ON `organization_submission_settings` (`organization_id`);
-- enable back the enforcement of foreign-keys constraints
PRAGMA foreign_keys = on;

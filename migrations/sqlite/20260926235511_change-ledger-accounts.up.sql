-- add column "invert_sign" to table: "accounts"
ALTER TABLE `accounts` ADD COLUMN `invert_sign` numeric NOT NULL DEFAULT false;
-- rename a column from "account_type" to "type"
ALTER TABLE `ledger_accounts` RENAME COLUMN `account_type` TO `type`;

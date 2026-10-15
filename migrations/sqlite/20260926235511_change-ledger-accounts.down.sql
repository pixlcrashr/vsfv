-- reverse: rename a column from "account_type" to "type"
ALTER TABLE `ledger_accounts` RENAME COLUMN `type` TO `account_type`;
-- reverse: add column "invert_sign" to table: "accounts"
ALTER TABLE `accounts` DROP COLUMN `invert_sign`;

/*
  Warnings:

  - A unique constraint covering the columns `[credit_transaction_account_id,debit_transaction_account_id,amount,description,reference,booked_at,document_date]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "transactions_credit_transaction_account_id_debit_transactio_key";

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "booked_at" SET DATA TYPE DATE,
ALTER COLUMN "document_date" SET DATA TYPE DATE;

-- CreateIndex
CREATE UNIQUE INDEX "transactions_credit_transaction_account_id_debit_transactio_key" ON "transactions"("credit_transaction_account_id", "debit_transaction_account_id", "amount", "description", "reference", "booked_at", "document_date");

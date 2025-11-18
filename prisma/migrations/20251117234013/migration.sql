/*
  Warnings:

  - A unique constraint covering the columns `[custom_id]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "custom_id" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "transactions_custom_id_key" ON "transactions"("custom_id");

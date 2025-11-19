/*
  Warnings:

  - You are about to drop the column `import_sources_id` on the `transaction_accounts` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code,import_source_id]` on the table `transaction_accounts` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `import_source_id` to the `transaction_accounts` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "transaction_accounts" DROP CONSTRAINT "transaction_accounts_import_sources_id_fkey";

-- AlterTable
ALTER TABLE "transaction_accounts" DROP COLUMN "import_sources_id",
ADD COLUMN     "import_source_id" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "transaction_accounts_code_import_source_id_key" ON "transaction_accounts"("code", "import_source_id");

-- AddForeignKey
ALTER TABLE "transaction_accounts" ADD CONSTRAINT "transaction_accounts_import_source_id_fkey" FOREIGN KEY ("import_source_id") REFERENCES "import_sources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

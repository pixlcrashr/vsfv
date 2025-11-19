/*
  Warnings:

  - Added the required column `import_sources_id` to the `transaction_accounts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "transaction_accounts" ADD COLUMN     "import_sources_id" UUID NOT NULL;

-- CreateTable
CREATE TABLE "import_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "display_name" TEXT NOT NULL DEFAULT '',
    "display_description" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_sources_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "transaction_accounts" ADD CONSTRAINT "transaction_accounts_import_sources_id_fkey" FOREIGN KEY ("import_sources_id") REFERENCES "import_sources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

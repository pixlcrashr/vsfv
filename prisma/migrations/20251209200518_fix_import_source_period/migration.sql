/*
  Warnings:

  - You are about to drop the column `startYear` on the `import_source_periods` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "import_source_periods" DROP COLUMN "startYear",
ADD COLUMN     "year" INTEGER NOT NULL DEFAULT 0;

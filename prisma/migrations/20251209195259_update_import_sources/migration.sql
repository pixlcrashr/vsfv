/*
  Warnings:

  - You are about to drop the column `period_end` on the `import_sources` table. All the data in the column will be lost.
  - You are about to drop the column `startYear` on the `import_sources` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "import_sources" DROP COLUMN "period_end",
DROP COLUMN "startYear";

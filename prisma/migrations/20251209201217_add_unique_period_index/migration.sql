/*
  Warnings:

  - A unique constraint covering the columns `[import_source_id,year]` on the table `import_source_periods` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "import_source_periods_import_source_id_year_key" ON "import_source_periods"("import_source_id", "year");

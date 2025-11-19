-- AlterTable
ALTER TABLE "import_sources" ADD COLUMN     "period_end" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "period_start" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "startYear" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "import_source_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "import_source_id" UUID NOT NULL,
    "startYear" INTEGER NOT NULL DEFAULT 0,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_source_periods_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "import_source_periods" ADD CONSTRAINT "import_source_periods_import_source_id_fkey" FOREIGN KEY ("import_source_id") REFERENCES "import_sources"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

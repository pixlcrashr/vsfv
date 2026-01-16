-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(16) NOT NULL,
    "value_float" DOUBLE PRECISION,
    "value_int" BIGINT,
    "value_text" TEXT,
    "value_bool" BOOLEAN,
    "value_decimal" DECIMAL,
    "value_uuid" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_settings_type" ON "settings"("type");

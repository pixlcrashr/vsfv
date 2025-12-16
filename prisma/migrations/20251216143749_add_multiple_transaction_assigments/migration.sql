-- CreateTable
CREATE TABLE "transaction_account_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transaction_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "value" DECIMAL NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_account_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_transaction_account_assignments_transaction_id" ON "transaction_account_assignments"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_transaction_account_assignments_account_id" ON "transaction_account_assignments"("account_id");

-- AddForeignKey
ALTER TABLE "transaction_account_assignments" ADD CONSTRAINT "transaction_account_assignments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transaction_account_assignments" ADD CONSTRAINT "transaction_account_assignments_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

/*
  Warnings:

  - The primary key for the `user_groups` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "user_groups" DROP CONSTRAINT "user_groups_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id");

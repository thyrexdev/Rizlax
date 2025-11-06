/*
  Warnings:

  - You are about to drop the column `balance` on the `Wallet` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELED');

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "isVerified" SET DEFAULT false;

-- AlterTable
ALTER TABLE "Wallet" DROP COLUMN "balance",
ADD COLUMN     "available_balance" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pending_balance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "escrow_accounts" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "freelancer_id" TEXT NOT NULL,
    "remaining_amount" INTEGER NOT NULL DEFAULT 0,
    "initial_amount" INTEGER NOT NULL DEFAULT 0,
    "status" "EscrowStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "escrow_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "escrow_accounts_contract_id_key" ON "escrow_accounts"("contract_id");

-- CreateIndex
CREATE INDEX "escrow_accounts_contract_id_idx" ON "escrow_accounts"("contract_id");

-- CreateIndex
CREATE INDEX "escrow_accounts_freelancer_id_status_idx" ON "escrow_accounts"("freelancer_id", "status");

-- CreateIndex
CREATE INDEX "escrow_accounts_client_id_status_idx" ON "escrow_accounts"("client_id", "status");

-- AddForeignKey
ALTER TABLE "escrow_accounts" ADD CONSTRAINT "escrow_accounts_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

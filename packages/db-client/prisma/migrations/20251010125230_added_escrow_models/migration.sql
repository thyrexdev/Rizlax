/*
  Warnings:

  - You are about to drop the column `remaining_amount` on the `escrow_accounts` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EscrowTransactionType" AS ENUM ('DEPOSIT', 'RELEASE', 'REFUND');

-- AlterTable
ALTER TABLE "escrow_accounts" DROP COLUMN "remaining_amount",
ADD COLUMN     "held_amount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "EscrowTransaction" (
    "id" TEXT NOT NULL,
    "escrowAccountId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "EscrowTransactionType" NOT NULL,
    "description" TEXT,
    "sourceWalletId" TEXT,
    "destinationWalletId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EscrowTransaction_escrowAccountId_idx" ON "EscrowTransaction"("escrowAccountId");

-- AddForeignKey
ALTER TABLE "EscrowTransaction" ADD CONSTRAINT "EscrowTransaction_escrowAccountId_fkey" FOREIGN KEY ("escrowAccountId") REFERENCES "escrow_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

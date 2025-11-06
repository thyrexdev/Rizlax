/*
  Warnings:

  - A unique constraint covering the columns `[proposalId]` on the table `Contract` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `amount` to the `Contract` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContractStatus" ADD VALUE 'DISPUTED';
ALTER TYPE "ContractStatus" ADD VALUE 'TERMINATED';
ALTER TYPE "ContractStatus" ADD VALUE 'REVIEW_PENDING';

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "amount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "proposalId" TEXT;

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contract_proposalId_key" ON "Contract"("proposalId");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

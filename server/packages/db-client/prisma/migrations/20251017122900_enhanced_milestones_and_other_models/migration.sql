/*
  Warnings:

  - You are about to drop the column `isPaid` on the `Milestone` table. All the data in the column will be lost.
  - The `country` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[phoneNumber]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sequence` to the `Milestone` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CountryCode" AS ENUM ('EG', 'SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'JO', 'LB', 'IQ', 'SY', 'PS', 'YE', 'MA', 'DZ', 'TN', 'LY', 'SD', 'MR', 'SO', 'DJ', 'PK', 'ID', 'TR', 'IR');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'PAID', 'DISPUTED', 'CANCELED');

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "reviewId" TEXT,
ADD COLUMN     "totalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Milestone" DROP COLUMN "isPaid",
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "escrowTransactionId" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "sequence" INTEGER NOT NULL,
ADD COLUMN     "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "submissionUrl" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ALTER COLUMN "dueDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "country",
ADD COLUMN     "country" "CountryCode" NOT NULL DEFAULT 'EG';

-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "relatedType" TEXT;

-- CreateIndex
CREATE INDEX "Contract_freelancerId_status_idx" ON "Contract"("freelancerId", "status");

-- CreateIndex
CREATE INDEX "Contract_clientId_status_idx" ON "Contract"("clientId", "status");

-- CreateIndex
CREATE INDEX "Review_freelancerId_idx" ON "Review"("freelancerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

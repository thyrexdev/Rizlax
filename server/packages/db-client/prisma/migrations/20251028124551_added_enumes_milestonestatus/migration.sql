-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MilestoneStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "MilestoneStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "disputedAt" TIMESTAMP(3);

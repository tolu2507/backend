-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AiFeature" ADD VALUE 'QUESTION_TAGGING';
ALTER TYPE "AiFeature" ADD VALUE 'QUESTION_WRITING';
ALTER TYPE "AiFeature" ADD VALUE 'QUESTION_CHECK';

-- AlterTable
ALTER TABLE "PastQuestion" ADD COLUMN     "brokenReason" TEXT;

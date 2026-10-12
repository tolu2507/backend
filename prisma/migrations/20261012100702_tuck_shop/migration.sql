-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TUCK_SHOP';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pinFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pinLockedUntil" TIMESTAMP(3);

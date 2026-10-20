-- CreateEnum
CREATE TYPE "StickerRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "CoinReason" AS ENUM ('PRACTICE', 'MOCK', 'STICKER', 'CONVERTED');

-- CreateEnum
CREATE TYPE "RewardKind" AS ENUM ('AIRTIME', 'DATA');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('SENDING', 'PENDING', 'SUCCESS', 'FAILED', 'CHECK');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerEntryType" ADD VALUE 'REWARD_EARNED';
ALTER TYPE "LedgerEntryType" ADD VALUE 'REWARD_REDEEMED';

-- AlterEnum
ALTER TYPE "WalletType" ADD VALUE 'REWARDS';

-- AlterTable
ALTER TABLE "Badge" ADD COLUMN     "coins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "rarity" "StickerRarity" NOT NULL DEFAULT 'COMMON',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StudentBadge" ADD COLUMN     "seenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "coins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "coinsTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "perfectRounds" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CoinEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "CoinReason" NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRedemption" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "kind" "RewardKind" NOT NULL,
    "network" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "planCode" TEXT,
    "planName" TEXT,
    "amountKobo" BIGINT NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'SENDING',
    "providerRef" TEXT,
    "providerMeta" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoinEvent_studentId_reason_createdAt_idx" ON "CoinEvent"("studentId", "reason", "createdAt");

-- CreateIndex
CREATE INDEX "RewardRedemption_parentId_createdAt_idx" ON "RewardRedemption"("parentId", "createdAt");

-- CreateIndex
CREATE INDEX "RewardRedemption_status_createdAt_idx" ON "RewardRedemption"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "CoinEvent" ADD CONSTRAINT "CoinEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Stickers awarded before celebrations existed count as already seen, so nobody gets a flood of old ones.
UPDATE "StudentBadge" SET "seenAt" = "awardedAt" WHERE "seenAt" IS NULL;

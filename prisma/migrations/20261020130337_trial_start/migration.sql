-- AlterTable
ALTER TABLE "User" ADD COLUMN     "trialStartedAt" TIMESTAMP(3);

-- Every trial so far started with 21 days, so the start is 21 days before the end it was given.
UPDATE "User" SET "trialStartedAt" = "trialEndsAt" - interval '21 days' WHERE "trialEndsAt" IS NOT NULL AND "trialStartedAt" IS NULL;

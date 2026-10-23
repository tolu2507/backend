-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ArenaKind" ADD VALUE 'LIVE';
ALTER TYPE "ArenaKind" ADD VALUE 'OLYMPIAD';

-- AlterTable
ALTER TABLE "ArenaMatch" ADD COLUMN     "olympiadId" TEXT;

-- CreateTable
CREATE TABLE "Olympiad" (
    "id" TEXT NOT NULL,
    "examSubjectId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "questionIds" TEXT[],
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Olympiad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Olympiad_settledAt_closesAt_idx" ON "Olympiad"("settledAt", "closesAt");

-- CreateIndex
CREATE UNIQUE INDEX "Olympiad_examSubjectId_day_key" ON "Olympiad"("examSubjectId", "day");

-- CreateIndex
CREATE INDEX "ArenaMatch_olympiadId_idx" ON "ArenaMatch"("olympiadId");

-- AddForeignKey
ALTER TABLE "ArenaMatch" ADD CONSTRAINT "ArenaMatch_olympiadId_fkey" FOREIGN KEY ("olympiadId") REFERENCES "Olympiad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Olympiad" ADD CONSTRAINT "Olympiad_examSubjectId_fkey" FOREIGN KEY ("examSubjectId") REFERENCES "ExamSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

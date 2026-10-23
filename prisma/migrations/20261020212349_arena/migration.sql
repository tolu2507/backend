-- CreateEnum
CREATE TYPE "ArenaKind" AS ENUM ('GHOST', 'ROOM');

-- CreateEnum
CREATE TYPE "ArenaStatus" AS ENUM ('WAITING', 'PLAYING', 'FINISHED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "XpReason" ADD VALUE 'ARENA';

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "arenaAllowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "chatAllowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "trophies" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ArenaMatch" (
    "id" TEXT NOT NULL,
    "kind" "ArenaKind" NOT NULL,
    "status" "ArenaStatus" NOT NULL DEFAULT 'PLAYING',
    "examSubjectId" TEXT NOT NULL,
    "code" TEXT,
    "hostId" TEXT,
    "questionIds" TEXT[],
    "ghostOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ArenaMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaPlayer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "place" INTEGER,
    "trophies" INTEGER,
    "xp" INTEGER,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ArenaPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaAnswer" (
    "playerId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "questionId" TEXT NOT NULL,
    "servedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "optionId" TEXT,
    "correct" BOOLEAN NOT NULL DEFAULT false,
    "ms" INTEGER,
    "points" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ArenaAnswer_pkey" PRIMARY KEY ("playerId","index")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArenaMatch_code_key" ON "ArenaMatch"("code");

-- CreateIndex
CREATE INDEX "ArenaMatch_examSubjectId_kind_finishedAt_idx" ON "ArenaMatch"("examSubjectId", "kind", "finishedAt");

-- CreateIndex
CREATE INDEX "ArenaPlayer_studentId_joinedAt_idx" ON "ArenaPlayer"("studentId", "joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaPlayer_matchId_studentId_key" ON "ArenaPlayer"("matchId", "studentId");

-- AddForeignKey
ALTER TABLE "ArenaMatch" ADD CONSTRAINT "ArenaMatch_examSubjectId_fkey" FOREIGN KEY ("examSubjectId") REFERENCES "ExamSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaMatch" ADD CONSTRAINT "ArenaMatch_ghostOfId_fkey" FOREIGN KEY ("ghostOfId") REFERENCES "ArenaPlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaPlayer" ADD CONSTRAINT "ArenaPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "ArenaMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaPlayer" ADD CONSTRAINT "ArenaPlayer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaAnswer" ADD CONSTRAINT "ArenaAnswer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "ArenaPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaAnswer" ADD CONSTRAINT "ArenaAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

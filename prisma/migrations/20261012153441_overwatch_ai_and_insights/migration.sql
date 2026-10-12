-- CreateEnum
CREATE TYPE "Curriculum" AS ENUM ('NIGERIAN', 'BRITISH', 'AMERICAN', 'MONTESSORI', 'IB', 'BLENDED');

-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM ('LESSON_QUIZ', 'WEEKLY_REPORT', 'ACTIVITY_DRAFT');

-- CreateTable
CREATE TABLE "SchoolAiProfile" (
    "schoolId" TEXT NOT NULL,
    "curriculum" "Curriculum" NOT NULL DEFAULT 'NIGERIAN',
    "instructions" TEXT,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "monthlyBudgetKobo" BIGINT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolAiProfile_pkey" PRIMARY KEY ("schoolId")
);

-- CreateTable
CREATE TABLE "CurriculumTopic" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "level" "EducationLevel" NOT NULL,
    "gradeName" TEXT,
    "subject" TEXT NOT NULL,
    "term" "TermName" NOT NULL,
    "week" INTEGER,
    "topic" TEXT NOT NULL,
    "objectives" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurriculumTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "feature" "AiFeature" NOT NULL,
    "model" TEXT NOT NULL,
    "schoolId" TEXT,
    "userId" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicroUsd" INTEGER NOT NULL DEFAULT 0,
    "ok" BOOLEAN NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CurriculumTopic_schoolId_subject_level_idx" ON "CurriculumTopic"("schoolId", "subject", "level");

-- CreateIndex
CREATE INDEX "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_schoolId_createdAt_idx" ON "AiUsage"("schoolId", "createdAt");

-- AddForeignKey
ALTER TABLE "SchoolAiProfile" ADD CONSTRAINT "SchoolAiProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumTopic" ADD CONSTRAINT "CurriculumTopic_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

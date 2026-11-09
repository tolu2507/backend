-- AlterEnum
ALTER TYPE "AiFeature" ADD VALUE 'LESSON_WRITING';

-- AlterEnum
ALTER TYPE "EducationLevel" ADD VALUE 'TERTIARY';

-- AlterEnum
ALTER TYPE "ExamBody" ADD VALUE 'UNIVERSITY';

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "department" TEXT;

-- CreateTable
CREATE TABLE "CourseLesson" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 8,
    "hook" TEXT NOT NULL,
    "slides" JSONB NOT NULL,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "status" "QuestionStatus" NOT NULL DEFAULT 'IN_REVIEW',
    "checkNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "studentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "slide" INTEGER NOT NULL DEFAULT 0,
    "checksRight" INTEGER NOT NULL DEFAULT 0,
    "checksTotal" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("studentId","lessonId")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseLesson_topicId_key" ON "CourseLesson"("topicId");

-- CreateIndex
CREATE INDEX "CourseLesson_status_idx" ON "CourseLesson"("status");

-- AddForeignKey
ALTER TABLE "CourseLesson" ADD CONSTRAINT "CourseLesson_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "SyllabusTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "CourseLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

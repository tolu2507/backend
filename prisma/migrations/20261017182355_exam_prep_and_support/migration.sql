-- CreateEnum
CREATE TYPE "ExamBody" AS ENUM ('JAMB', 'WAEC', 'NECO', 'BECE');

-- CreateEnum
CREATE TYPE "QuestionOrigin" AS ENUM ('GENERATED', 'TEMPLATE', 'AUTHORED');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'RETIRED');

-- CreateEnum
CREATE TYPE "MockStatus" AS ENUM ('SCHEDULED', 'OPEN', 'CLOSED', 'RESULTS_OUT');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'WAITING_ON_USER', 'RESOLVED');

-- CreateTable
CREATE TABLE "ExamSubject" (
    "id" TEXT NOT NULL,
    "exam" "ExamBody" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isCompulsory" BOOLEAN NOT NULL DEFAULT false,
    "mockQuestions" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyllabusTopic" (
    "id" TEXT NOT NULL,
    "examSubjectId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION,
    "yearsSeen" INTEGER,
    "examinerNotes" TEXT,

    CONSTRAINT "SyllabusTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastQuestion" (
    "id" TEXT NOT NULL,
    "examSubjectId" TEXT NOT NULL,
    "topicId" TEXT,
    "year" INTEGER NOT NULL,
    "paper" TEXT,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "stem" TEXT NOT NULL,
    "options" JSONB,
    "answer" TEXT,
    "explanation" TEXT,
    "examinerNote" TEXT,
    "difficulty" INTEGER,
    "questionType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PastQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL,
    "examSubjectId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "stem" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "answerId" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "origin" "QuestionOrigin" NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "templateId" TEXT,
    "modelledOnId" TEXT,
    "checkNotes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "timesServed" INTEGER NOT NULL DEFAULT 0,
    "timesCorrect" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionTemplate" (
    "id" TEXT NOT NULL,
    "examSubjectId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "spec" JSONB NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentExam" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "exam" "ExamBody" NOT NULL,
    "targetYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentExamSubject" (
    "studentExamId" TEXT NOT NULL,
    "examSubjectId" TEXT NOT NULL,

    CONSTRAINT "StudentExamSubject_pkey" PRIMARY KEY ("studentExamId","examSubjectId")
);

-- CreateTable
CREATE TABLE "QuestionSeen" (
    "studentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timesSeen" INTEGER NOT NULL DEFAULT 1,
    "lastCorrect" BOOLEAN NOT NULL,
    "reviewDueAt" TIMESTAMP(3),

    CONSTRAINT "QuestionSeen_pkey" PRIMARY KEY ("studentId","questionId")
);

-- CreateTable
CREATE TABLE "TopicProgress" (
    "studentId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "mastery" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "answered" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "bossBeaten" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicProgress_pkey" PRIMARY KEY ("studentId","topicId")
);

-- CreateTable
CREATE TABLE "MockExam" (
    "id" TEXT NOT NULL,
    "exam" "ExamBody" NOT NULL,
    "title" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" "MockStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockSitting" (
    "id" TEXT NOT NULL,
    "mockId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "questions" JSONB NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "score" INTEGER,
    "subjectScores" JSONB,
    "nationalRank" INTEGER,
    "percentile" DOUBLE PRECISION,

    CONSTRAINT "MockSitting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionReport" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentId" TEXT,
    "subject" TEXT NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "fromStaff" BOOLEAN NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamSubject_exam_slug_key" ON "ExamSubject"("exam", "slug");

-- CreateIndex
CREATE INDEX "SyllabusTopic_examSubjectId_idx" ON "SyllabusTopic"("examSubjectId");

-- CreateIndex
CREATE UNIQUE INDEX "SyllabusTopic_examSubjectId_parentId_name_key" ON "SyllabusTopic"("examSubjectId", "parentId", "name");

-- CreateIndex
CREATE INDEX "PastQuestion_examSubjectId_year_idx" ON "PastQuestion"("examSubjectId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "PastQuestion_source_sourceId_key" ON "PastQuestion"("source", "sourceId");

-- CreateIndex
CREATE INDEX "ExamQuestion_examSubjectId_topicId_difficulty_status_idx" ON "ExamQuestion"("examSubjectId", "topicId", "difficulty", "status");

-- CreateIndex
CREATE INDEX "ExamQuestion_status_createdAt_idx" ON "ExamQuestion"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentExam_studentId_exam_key" ON "StudentExam"("studentId", "exam");

-- CreateIndex
CREATE INDEX "QuestionSeen_studentId_reviewDueAt_idx" ON "QuestionSeen"("studentId", "reviewDueAt");

-- CreateIndex
CREATE INDEX "MockExam_status_opensAt_idx" ON "MockExam"("status", "opensAt");

-- CreateIndex
CREATE UNIQUE INDEX "MockExam_exam_opensAt_key" ON "MockExam"("exam", "opensAt");

-- CreateIndex
CREATE INDEX "MockSitting_mockId_score_idx" ON "MockSitting"("mockId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "MockSitting_mockId_studentId_key" ON "MockSitting"("mockId", "studentId");

-- CreateIndex
CREATE INDEX "QuestionReport_status_createdAt_idx" ON "QuestionReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_status_updatedAt_idx" ON "SupportTicket"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "SyllabusTopic" ADD CONSTRAINT "SyllabusTopic_examSubjectId_fkey" FOREIGN KEY ("examSubjectId") REFERENCES "ExamSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyllabusTopic" ADD CONSTRAINT "SyllabusTopic_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SyllabusTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastQuestion" ADD CONSTRAINT "PastQuestion_examSubjectId_fkey" FOREIGN KEY ("examSubjectId") REFERENCES "ExamSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastQuestion" ADD CONSTRAINT "PastQuestion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "SyllabusTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_examSubjectId_fkey" FOREIGN KEY ("examSubjectId") REFERENCES "ExamSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "SyllabusTopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuestionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_modelledOnId_fkey" FOREIGN KEY ("modelledOnId") REFERENCES "PastQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamQuestion" ADD CONSTRAINT "ExamQuestion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionTemplate" ADD CONSTRAINT "QuestionTemplate_examSubjectId_fkey" FOREIGN KEY ("examSubjectId") REFERENCES "ExamSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionTemplate" ADD CONSTRAINT "QuestionTemplate_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "SyllabusTopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExam" ADD CONSTRAINT "StudentExam_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExamSubject" ADD CONSTRAINT "StudentExamSubject_studentExamId_fkey" FOREIGN KEY ("studentExamId") REFERENCES "StudentExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExamSubject" ADD CONSTRAINT "StudentExamSubject_examSubjectId_fkey" FOREIGN KEY ("examSubjectId") REFERENCES "ExamSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSeen" ADD CONSTRAINT "QuestionSeen_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSeen" ADD CONSTRAINT "QuestionSeen_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicProgress" ADD CONSTRAINT "TopicProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicProgress" ADD CONSTRAINT "TopicProgress_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "SyllabusTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockSitting" ADD CONSTRAINT "MockSitting_mockId_fkey" FOREIGN KEY ("mockId") REFERENCES "MockExam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockSitting" ADD CONSTRAINT "MockSitting_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionReport" ADD CONSTRAINT "QuestionReport_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionReport" ADD CONSTRAINT "QuestionReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

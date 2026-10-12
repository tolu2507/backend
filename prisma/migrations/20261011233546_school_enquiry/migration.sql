-- CreateTable
CREATE TABLE "SchoolEnquiry" (
    "id" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "state" TEXT,
    "studentCount" TEXT,
    "levels" "EducationLevel"[],
    "message" TEXT,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolEnquiry_handled_createdAt_idx" ON "SchoolEnquiry"("handled", "createdAt");

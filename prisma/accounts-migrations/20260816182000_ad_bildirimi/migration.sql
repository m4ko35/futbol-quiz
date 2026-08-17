-- CreateTable
CREATE TABLE "name_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "name_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "name_reports_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "name_reports_reportedId_idx" ON "name_reports"("reportedId");

-- CreateIndex
CREATE UNIQUE INDEX "name_reports_reporterId_reportedId_key" ON "name_reports"("reporterId", "reportedId");


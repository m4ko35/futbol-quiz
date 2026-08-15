-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "displayNameKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "daily_rounds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "puzzleDay" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_rounds_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "round_answers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "statKey" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "round_answers_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "daily_rounds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_subjectHash_key" ON "users"("subjectHash");

-- CreateIndex
CREATE UNIQUE INDEX "users_displayNameKey_key" ON "users"("displayNameKey");

-- CreateIndex
CREATE INDEX "daily_rounds_puzzleDay_points_idx" ON "daily_rounds"("puzzleDay", "points");

-- CreateIndex
CREATE UNIQUE INDEX "daily_rounds_userId_puzzleDay_key" ON "daily_rounds"("userId", "puzzleDay");

-- CreateIndex
CREATE UNIQUE INDEX "round_answers_roundId_statKey_key" ON "round_answers"("roundId", "statKey");

-- CreateIndex
CREATE UNIQUE INDEX "round_answers_roundId_playerId_key" ON "round_answers"("roundId", "playerId");


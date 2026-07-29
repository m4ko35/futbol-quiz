-- CreateTable
CREATE TABLE "leagues" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wikidataId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1
);

-- CreateTable
CREATE TABLE "clubs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wikidataId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "searchKey" TEXT NOT NULL,
    "country" TEXT,
    "foundedYear" INTEGER,
    "crestUrl" TEXT,
    "isSelectable" BOOLEAN NOT NULL DEFAULT false,
    "leagueId" TEXT,
    CONSTRAINT "clubs_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wikidataId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "searchKey" TEXT NOT NULL,
    "birthDate" DATETIME,
    "nationality" TEXT,
    "position" TEXT
);

-- CreateTable
CREATE TABLE "spells" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wikidataStatementId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "isLoan" BOOLEAN NOT NULL DEFAULT false,
    "isYouth" BOOLEAN NOT NULL DEFAULT false,
    "appearances" INTEGER,
    "goals" INTEGER,
    CONSTRAINT "spells_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "spells_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "leagues_wikidataId_key" ON "leagues"("wikidataId");

-- CreateIndex
CREATE UNIQUE INDEX "clubs_wikidataId_key" ON "clubs"("wikidataId");

-- CreateIndex
CREATE INDEX "clubs_searchKey_idx" ON "clubs"("searchKey");

-- CreateIndex
CREATE INDEX "clubs_isSelectable_idx" ON "clubs"("isSelectable");

-- CreateIndex
CREATE UNIQUE INDEX "players_wikidataId_key" ON "players"("wikidataId");

-- CreateIndex
CREATE INDEX "players_searchKey_idx" ON "players"("searchKey");

-- CreateIndex
CREATE UNIQUE INDEX "spells_wikidataStatementId_key" ON "spells"("wikidataStatementId");

-- CreateIndex
CREATE INDEX "spells_clubId_playerId_idx" ON "spells"("clubId", "playerId");

-- CreateIndex
CREATE INDEX "spells_playerId_idx" ON "spells"("playerId");

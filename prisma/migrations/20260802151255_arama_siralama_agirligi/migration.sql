-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_players" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wikidataId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "searchKey" TEXT NOT NULL,
    "birthDate" DATETIME,
    "nationality" TEXT,
    "position" TEXT,
    "nationalCaps" INTEGER,
    "heightCm" INTEGER,
    "weightKg" INTEGER,
    "careerAppearances" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_players" ("birthDate", "heightCm", "id", "name", "nationalCaps", "nationality", "position", "searchKey", "weightKg", "wikidataId") SELECT "birthDate", "heightCm", "id", "name", "nationalCaps", "nationality", "position", "searchKey", "weightKg", "wikidataId" FROM "players";
DROP TABLE "players";
ALTER TABLE "new_players" RENAME TO "players";
CREATE UNIQUE INDEX "players_wikidataId_key" ON "players"("wikidataId");
CREATE INDEX "players_searchKey_idx" ON "players"("searchKey");
CREATE INDEX "players_careerAppearances_idx" ON "players"("careerAppearances");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

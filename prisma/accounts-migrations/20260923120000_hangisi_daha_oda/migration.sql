-- CreateTable
CREATE TABLE "room_which_more_answers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomPlayerId" TEXT NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "chosenId" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "room_which_more_answers_roomPlayerId_fkey" FOREIGN KEY ("roomPlayerId") REFERENCES "room_players" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_rooms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'istatistik',
    "config" TEXT,
    "targetPlayerId" TEXT,
    "startedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rooms_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_rooms" ("code", "createdAt", "hostId", "id", "startedAt", "targetPlayerId") SELECT "code", "createdAt", "hostId", "id", "startedAt", "targetPlayerId" FROM "rooms";
DROP TABLE "rooms";
ALTER TABLE "new_rooms" RENAME TO "rooms";
CREATE UNIQUE INDEX "rooms_code_key" ON "rooms"("code");
CREATE INDEX "rooms_createdAt_idx" ON "rooms"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "room_which_more_answers_roomPlayerId_roundIndex_key" ON "room_which_more_answers"("roomPlayerId", "roundIndex");

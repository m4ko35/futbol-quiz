-- Izgara (XOX) odasi — PROJECT.md §12.9, BR-71..BR-76.
--
-- Ucuncu oda modunun hamle tablosu. `rooms` DEGISMEZ: `mode`/`config` sutunlari
-- Hangisi Daha gocunde (20260923120000) zaten eklendi; Izgara odasi `mode`
-- degerini 'izgara', `config`'i { seed, firstSeat } ile kullanir. Bu goc yalniz
-- yeni tabloyu ve iki oda-kapsamli tekil kisitini ekler.
--
-- @@unique([roomId, cellRow, cellCol]) — bir hucre bir kez kapatilir (BR-73).
-- @@unique([roomId, moveIndex])        — tek turda iki hamle yarisini durdurur (BR-72).

-- CreateTable
CREATE TABLE "room_grid_moves" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moveIndex" INTEGER NOT NULL,
    "cellRow" INTEGER NOT NULL,
    "cellCol" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "room_grid_moves_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "room_grid_moves_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "room_grid_moves_roomId_cellRow_cellCol_key" ON "room_grid_moves"("roomId", "cellRow", "cellCol");

-- CreateIndex
CREATE UNIQUE INDEX "room_grid_moves_roomId_moveIndex_key" ON "room_grid_moves"("roomId", "moveIndex");

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_clubs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wikidataId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "searchKey" TEXT NOT NULL,
    "country" TEXT,
    "foundedYear" INTEGER,
    "crestUrl" TEXT,
    "crestLicense" TEXT,
    "crestAuthor" TEXT,
    "crestFilePage" TEXT,
    "playerCount" INTEGER NOT NULL DEFAULT 0,
    "isSelectable" BOOLEAN NOT NULL DEFAULT false,
    "leagueId" TEXT,
    CONSTRAINT "clubs_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_clubs" ("country", "crestAuthor", "crestFilePage", "crestLicense", "crestUrl", "foundedYear", "id", "isSelectable", "leagueId", "name", "searchKey", "shortName", "wikidataId") SELECT "country", "crestAuthor", "crestFilePage", "crestLicense", "crestUrl", "foundedYear", "id", "isSelectable", "leagueId", "name", "searchKey", "shortName", "wikidataId" FROM "clubs";
DROP TABLE "clubs";
ALTER TABLE "new_clubs" RENAME TO "clubs";
CREATE UNIQUE INDEX "clubs_wikidataId_key" ON "clubs"("wikidataId");
CREATE INDEX "clubs_searchKey_idx" ON "clubs"("searchKey");
CREATE INDEX "clubs_isSelectable_idx" ON "clubs"("isSelectable");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Geriye doldurma — BR-36.
--
-- Varsayilan 0 birakilamaz: tam bir ETL kosusu olmadan kural sessizce SUSAR
-- (payda sifir) ve dejenere cift uyarisi hic cikmaz. Mevcut veri kumesi bir
-- derleme ciktisidir ve yeniden uretmek saatler surer; hesap ETL'dekiyle
-- ayni tanimi kullanarak burada yapilir.
--
-- KAYIT DEGIL KISI: ayni oyuncu ayni kulupte birden cok donem gecirmis
-- olabilir, bu yuzden COUNT(DISTINCT playerId).
-- isYouth SQLite'ta 0/1 saklanir (BR-2: altyapi sayilmaz).
UPDATE "clubs" SET "playerCount" = (
    SELECT COUNT(DISTINCT "spells"."playerId")
    FROM "spells"
    WHERE "spells"."clubId" = "clubs"."id" AND "spells"."isYouth" = 0
);

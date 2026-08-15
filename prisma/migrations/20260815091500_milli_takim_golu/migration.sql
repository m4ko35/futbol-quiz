-- Milli takim golu — PROJECT.md §9.2.
--
-- "Toplam resmi gol" istatistiginin BIRINCI yarisi. Deger, `nationalCaps`
-- ile ayni Wikidata ifadesinden (`pq:P1351`) gelir; toplama maliyeti sifir.
--
-- Sutun BOS baslar ve ilk ETL kosusunda dolar. Mevcut derlemede `NULL`
-- olmasi dogru davranistir: `null` sifir degildir (§2.7) ve hicbir oyun
-- modu bu alani henuz okumuyor.
ALTER TABLE "players" ADD COLUMN "nationalGoals" INTEGER;

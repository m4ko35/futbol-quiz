-- Kulup kariyer toplami — PROJECT.md §9.2.
--
-- "Toplam resmi gol" istatistiginin IKINCI yarisi: lig + yerel kupa +
-- Avrupa. Deger Vikipedi'nin kariyer istatistigi tablosunun toplam
-- satirindan gelir; Wikidata'da bu kirilim YOKTUR (`P6509` havuzun
-- %0,1'inde dolu, olculdu).
--
-- `careerAppearances` ile KARISTIRILMAMALI — o BR-21'in arama siralama
-- agirligidir ve yalnizca kapsamdaki 24 ligi sayar.
--
-- Sutunlar BOS baslar ve ilk ETL kosusunda dolar; `null` sifir degildir
-- (§2.7) ve hicbir oyun modu bu alanlari henuz okumuyor.
ALTER TABLE "players" ADD COLUMN "clubCareerAppearances" INTEGER;
ALTER TABLE "players" ADD COLUMN "clubCareerGoals" INTEGER;

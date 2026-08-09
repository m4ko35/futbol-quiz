-- Veri onarimi (sema degisikligi YOK) — BR-2.
--
-- `looksLikeYouthOrReserve` kalibi ad sonundaki "II" ekini yedek takim
-- geleneği (`Ajax II`) sanip **Willem II**'yi altyapi isaretledi. Kulup bir
-- Eredivisie takimi; 510 doneminin hepsi altyapi sayildigi icin BR-2 onlari
-- her modda eliyordu ve kulup sifir sonuc veriyordu.
--
-- Kalip duzeltildi (normalize.ts). Bu dosya MEVCUT derleme ciktisini onarir:
-- veri kumesini yeniden uretmek saatler suruyor ve kusur o zamana kadar
-- ekranda kalirdi.
--
-- 992 kulubun tamami tarandi: kaliba takilan baska kulup YOK, gercek yedek
-- takim da yok. Bu yuzden onarim tek bir QID'ye baglidir.
UPDATE "spells"
SET "isYouth" = 0
WHERE "clubId" IN (SELECT "id" FROM "clubs" WHERE "wikidataId" = 'Q332664');

-- BR-36 paydasi bu kuluple ilgili olarak yeniden hesaplanir: onarimdan once
-- 0 idi (altyapi disi donemi yoktu) ve dejenerelik kurali onun icin susardi.
UPDATE "clubs"
SET "playerCount" = (
    SELECT COUNT(DISTINCT "spells"."playerId")
    FROM "spells"
    WHERE "spells"."clubId" = "clubs"."id" AND "spells"."isYouth" = 0
)
WHERE "wikidataId" = 'Q332664';

-- BR-23 / §9.2 (27 Ağustos 2026): A millî takım üyeliği sinyali.
-- `nationalCaps` yalnızca maç sayısı (P1350) olan üyelikten gelir; bu alan
-- üyeliğin KENDİSİNİ taşır, böylece "hiç oynamamış" (üyelik yok → millî katkı 0)
-- ile "oynamış ama sayı eksik" (üyelik var, caps null → bilinmiyor) ayrılır.
-- `null` = henüz ölçülmemiş (geçiş yedeği); ilk ETL koşusu doldurur.
ALTER TABLE "players" ADD COLUMN "nationalTeamMember" BOOLEAN;

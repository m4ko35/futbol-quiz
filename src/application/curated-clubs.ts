/**
 * Küratörlü kulüp listesi — PROJECT.md §9.1, §9.2.
 *
 * İKİ MODUN ORTAK KAVRAMI. Izgara bu kulüpleri kriter olarak kullanır (§9.1);
 * istatistik eşleştirme, günün oyuncusunu bu kulüplerde oynamışlar arasından
 * seçer (§9.2). İkisinde de sorulan şey aynı: "bu kulüp tanıdık mı".
 *
 * Bu yüzden liste `game-modes/grid/` altından buraya taşındı. Orada kalsaydı
 * ikinci mod "ızgara havuzunu" içe aktarır ve adı ne yaptığını yanlış
 * anlatırdı.
 *
 * NEDEN KÜRATÖRLÜ. İlk tasarım havuzu "en çok oyunculu N kulüp" diye
 * seçiyordu. Ölçüm bunu çürüttü: oyuncu sayısı kulübün TANINIRLIĞINI değil
 * YAŞINI ölçüyor. En çok oyunculu 60 kulüpte Genoa (1313), Bradford City
 * (1183), Calcio Padova (866) var; Real Madrid (824), Bayern (766), PSG (588)
 * ve Galatasaray (681) YOK.
 *
 * Ardından veride bir tanınırlık sinyali arandı ve BULUNAMADI:
 *   · `leagueId`  → 388 kulübün 388'inde dolu, ayırt etmiyor
 *   · `crestUrl`  → yalnızca 114 kulüpte; Real Madrid, PSG, Man Utd,
 *                   Arsenal ve Fenerbahçe'de yok
 *
 * Tanınırlık ölçülebilir bir veri değil, bir ÜRÜN KARARIDIR. Bu yüzden liste
 * elle kurulur ve **QID ile** sabitlenir — ada güvenmek bu projede dört kez
 * yanılttı (§10.1). Listeyi büyütmek/küçültmek bir kod değişikliğidir ve
 * `db:verify` her QID'nin veri kümesinde gerçekten var olduğunu denetler.
 *
 * LİSTEYİ KİM SEÇTİ. Liste ürün sahibinin kararıdır. Önce 345 seçilebilir
 * kulübün tamamı önüne konarak 82 kulüp seçildi; 2026-10-22'de liste yeniden
 * daraltıldı ve en tanınmış **39 kulüpte** karar kılındı (ligler: PL 8, Serie A
 * 6, Ligue 1 5, La Liga 4, Bundesliga 8, Süper Lig 8). Yorum satırlarındaki sayı
 * o kulübün profesyonel oyuncu sayısıdır; SEÇİM ÖLÇÜTÜ DEĞİL, yalnızca hücrenin
 * dolabilme ihtimalini gösterir. Düşük sayılı kulüpler (Başakşehir 188,
 * RB Leipzig 189) listede kalır ama üretim onları çoğu gün eler (BR-9) —
 * eksik oldukları için değil, genç oldukları için.
 */

/** Kulüpler, ligine göre gruplanmış (yalnızca okunabilirlik için). */
export const CURATED_CLUB_QIDS: readonly string[] = [
  // Premier League (8)
  "Q18656", // Manchester United — 1269
  "Q50602", // Manchester City — 1133
  "Q1130849", // Liverpool — 1098
  "Q5794", // Everton — 1087
  "Q9617", // Arsenal — 1067
  "Q18711", // Aston Villa — 1067
  "Q18741", // Tottenham Hotspur — 1046
  "Q9616", // Chelsea — 890

  // Serie A (6)
  "Q631", // Internazionale — 1417
  "Q1543", // A.C. Milan — 1271
  "Q1422", // Juventus — 1137
  "Q2739", // Roma — 1013
  "Q2609", // Lazio — 992
  "Q2641", // Napoli — 913

  // Ligue 1 (5)
  "Q132885", // Olympique de Marseille — 878
  "Q180305", // Monaco — 652
  "Q704", // Olympique Lyonnais — 599
  "Q19516", // Lille OSC — 594
  "Q483020", // Paris Saint-Germain — 588

  // La Liga (4)
  "Q7156", // Barcelona — 1419
  "Q8682", // Real Madrid — 824
  "Q8701", // Atlético Madrid — 799
  "Q10329", // Sevilla — 548

  // Bundesliga (8)
  "Q15789", // Bayern München — 766
  "Q4512", // Stuttgart — 758
  "Q51974", // Hamburger SV — 630
  "Q32494", // Schalke 04 — 598
  "Q38245", // Eintracht Frankfurt — 577
  "Q41420", // Borussia Dortmund — 499
  "Q104761", // Bayer Leverkusen — 478
  "Q702455", // RB Leipzig — 189

  // Süper Lig (8)
  "Q495299", // Galatasaray — 681
  "Q6601875", // Fenerbahçe — 649
  "Q172567", // Beşiktaş — 455
  "Q192641", // Trabzonspor — 424
  "Q203573", // Bursaspor — 334
  "Q513840", // Konyaspor — 313
  "Q1423118", // Göztepe — 277
  "Q857938", // İstanbul Başakşehir — 188
];

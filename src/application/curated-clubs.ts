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
 * LİSTEYİ KİM SEÇTİ. Aşağıdaki 82 kulübü ürün sahibi, veri kümesindeki 345
 * seçilebilir kulübün tamamı önüne konarak seçti. Yorum satırlarındaki sayı o
 * kulübün profesyonel oyuncu sayısıdır; SEÇİM ÖLÇÜTÜ DEĞİL, yalnızca hücrenin
 * dolabilme ihtimalini gösterir. Düşük sayılı kulüpler (Başakşehir 188,
 * RB Leipzig 189) listede kalır ama üretim onları çoğu gün eler (BR-9) —
 * eksik oldukları için değil, genç oldukları için.
 */

/** Kulüpler, ligine göre gruplanmış (yalnızca okunabilirlik için). */
export const CURATED_CLUB_QIDS: readonly string[] = [
  // Premier League (20)
  "Q19571", // Brentford — 1294
  "Q18736", // Stoke City — 1291
  "Q18656", // Manchester United — 1269
  "Q19458", // Burnley — 1189
  "Q50602", // Manchester City — 1133
  "Q1130849", // Liverpool — 1098
  "Q18732", // Southampton — 1090
  "Q5794", // Everton — 1087
  "Q9617", // Arsenal — 1067
  "Q18711", // Aston Villa — 1067
  "Q19500", // Wolverhampton Wanderers — 1051
  "Q18741", // Tottenham Hotspur — 1046
  "Q18747", // West Ham United — 1045
  "Q19467", // Crystal Palace — 989
  "Q19481", // Leicester City — 979
  "Q18716", // Newcastle United — 961
  "Q19490", // Nottingham Forest — 924
  "Q9616", // Chelsea — 890
  "Q19477", // Hull City — 763
  "Q19568", // Bournemouth — 731

  // Serie A (13)
  "Q631", // Internazionale — 1417
  "Q2074", // Genoa — 1313
  "Q1543", // A.C. Milan — 1271
  "Q1422", // Juventus — 1137
  "Q2768", // Torino — 1130
  "Q2052", // Fiorentina — 1058
  "Q2693", // Parma — 1045
  "Q2739", // Roma — 1013
  "Q1886", // Atalanta — 1010
  "Q2609", // Lazio — 992
  "Q2641", // Napoli — 913
  "Q1893", // Bologna — 858
  "Q1120838", // Como — 797

  // Ligue 1 (12)
  "Q132885", // Olympique de Marseille — 878
  "Q19509", // Stade Rennais — 717
  "Q180305", // Monaco — 652
  "Q704", // Olympique Lyonnais — 599
  "Q19521", // Saint-Étienne — 595
  "Q19516", // Lille OSC — 594
  "Q483020", // Paris Saint-Germain — 588
  "Q185163", // OGC Nice — 586
  "Q172476", // Girondins de Bordeaux — 585
  "Q191843", // Lens — 579
  "Q192071", // Nantes — 518
  "Q328658", // Le Havre — 492

  // La Liga (13)
  "Q7156", // Barcelona — 1419
  "Q8780", // RCD Espanyol — 1004
  "Q8682", // Real Madrid — 824
  "Q8701", // Atlético Madrid — 799
  "Q8687", // Athletic Bilbao — 743
  "Q8760", // Deportivo La Coruña — 712
  "Q8749", // Celta de Vigo — 631
  "Q8723", // Real Betis — 593
  "Q10315", // Real Sociedad — 557
  "Q10329", // Sevilla — 548
  "Q10333", // Valencia — 479
  "Q12297", // Villarreal — 347
  "Q11945", // Girona — 301

  // Bundesliga (15)
  "Q15789", // Bayern München — 766
  "Q4512", // Stuttgart — 758
  "Q51974", // Hamburger SV — 630
  "Q32494", // Schalke 04 — 598
  "Q38245", // Eintracht Frankfurt — 577
  "Q104770", // 1. FC Köln — 570
  "Q41420", // Borussia Dortmund — 499
  "Q104761", // Bayer Leverkusen — 478
  "Q51976", // Werder Bremen — 457
  "Q101959", // Borussia Mönchengladbach — 454
  "Q101859", // Wolfsburg — 419
  "Q15755", // Augsburg — 336
  "Q141971", // 1. FC Union Berlin — 311
  "Q22707", // 1899 Hoffenheim — 238
  "Q702455", // RB Leipzig — 189

  // Süper Lig (9)
  "Q495299", // Galatasaray — 681
  "Q6601875", // Fenerbahçe — 649
  "Q172567", // Beşiktaş — 455
  "Q192641", // Trabzonspor — 424
  "Q203573", // Bursaspor — 334
  "Q513840", // Konyaspor — 313
  "Q272712", // Çaykur Rizespor — 288
  "Q1423118", // Göztepe — 277
  "Q857938", // İstanbul Başakşehir — 188
];

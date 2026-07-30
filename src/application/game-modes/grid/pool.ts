/**
 * Izgara kriter havuzu — PROJECT.md §9.1.
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
 */

/** Havuzdaki kulüpler, ligine göre gruplanmış (yalnızca okunabilirlik için). */
export const GRID_CLUB_QIDS: readonly string[] = [
  // Premier League
  "Q18656", // Manchester United
  "Q50602", // Manchester City
  "Q1130849", // Liverpool
  "Q9617", // Arsenal
  "Q9616", // Chelsea
  "Q18741", // Tottenham Hotspur
  "Q5794", // Everton
  "Q18716", // Newcastle United
  "Q18711", // Aston Villa
  "Q19481", // Leicester City
  "Q18747", // West Ham United

  // La Liga
  "Q7156", // Barcelona
  "Q8682", // Real Madrid
  "Q8701", // Atlético Madrid
  "Q10329", // Sevilla
  "Q10333", // Valencia
  "Q8687", // Athletic Bilbao
  "Q8723", // Real Betis
  "Q10315", // Real Sociedad
  "Q8749", // Celta de Vigo

  // Serie A
  "Q1422", // Juventus
  "Q1543", // A.C. Milan
  "Q631", // Internazionale
  "Q2739", // Roma
  "Q2641", // Napoli
  "Q2609", // Lazio
  "Q2052", // Fiorentina
  "Q1886", // Atalanta
  "Q2768", // Torino
  "Q1457", // Sampdoria
  "Q1893", // Bologna

  // Bundesliga
  "Q15789", // Bayern München
  "Q41420", // Borussia Dortmund
  "Q32494", // Schalke 04
  "Q104761", // Bayer Leverkusen
  "Q51976", // Werder Bremen
  "Q51974", // Hamburger SV
  "Q38245", // Eintracht Frankfurt
  "Q4512", // Stuttgart
  "Q101959", // Borussia Mönchengladbach
  "Q104770", // 1. FC Köln

  // Ligue 1
  "Q483020", // Paris Saint-Germain
  "Q132885", // Olympique de Marseille
  "Q704", // Olympique Lyonnais
  "Q180305", // Monaco
  "Q19516", // Lille OSC
  "Q19521", // Saint-Étienne
  "Q192071", // Nantes
  "Q172476", // Girondins de Bordeaux
  "Q19509", // Stade Rennais
  "Q185163", // OGC Nice

  // Süper Lig
  "Q495299", // Galatasaray
  "Q6601875", // Fenerbahçe
  "Q172567", // Beşiktaş
  "Q192641", // Trabzonspor
  "Q203573", // Bursaspor
  "Q513840", // Konyaspor
];

/**
 * Ülke ekseni havuzu.
 *
 * ÖLÇÜM (§9.1): ülke × kulüp kesişimleri iki kutuplu — medyan 4, p95 557.
 * Yani çoğu çift ya tahmin edilemez ya bedava; yalnızca %40'ı oynanabilir
 * banda düşüyor. Havuz bu yüzden dar tutuldu: futbolda yaygın temsil edilen,
 * ama tek bir ligi domine etmeyen ülkeler. Bandın dışına düşen kombinasyonlar
 * üretim sırasında zaten elenir (BR-9).
 *
 * KODLAR VERİDEN OKUNARAK SEÇİLDİ, tahminle değil. İlk liste "futbolda akla
 * gelen ülkeler" diye yazılmıştı ve ölçüm iki hata gösterdi: `DK` için veri
 * kümesinde **hiç** oyuncu yok, `MA`/`CO`/`GR`/`JP` ise 200'ün altında —
 * havuzda durup boşuna deneme harcarlar. Liste, en az ~200 oyuncusu ölçülmüş
 * kodlarla değiştirildi.
 */
export const GRID_NATIONALITY_CODES: readonly string[] = [
  "GB", // 18.617 — kendi ligindeki kulüplerle bandın üstünde kalır, yabancı kulüplerle ilginç
  "IT", // 11.465
  "DE", // 7.864
  "ES", // 7.698
  "FR", // 7.336
  "TR", // 3.123
  "BR", // 1.332
  "AR", // 1.247
  "IE", // 706
  "NL", // 605
  "PT", // 542
  "PL", // 476
  "RS", // 452
  "UY", // 421
  "CH", // 416
  "BE", // 412
  "SE", // 391
  "HR", // 390
  "HU", // 375
  "AT", // 373
  "US", // 346
  "NG", // 312
  "RO", // 286
  "AU", // 276
  "GH", // 265
  "CZ", // 254
  "NO", // 244
  "CM", // 228
  "SN", // 227
  "CI", // 200
];

/** Ülke kodundan gösterilecek ad. Arayüz Türkçedir (§1.2). */
export const NATIONALITY_LABELS: Readonly<Record<string, string>> = {
  GB: "Birleşik Krallık",
  IT: "İtalya",
  DE: "Almanya",
  ES: "İspanya",
  FR: "Fransa",
  TR: "Türkiye",
  BR: "Brezilya",
  AR: "Arjantin",
  IE: "İrlanda",
  NL: "Hollanda",
  PT: "Portekiz",
  PL: "Polonya",
  RS: "Sırbistan",
  UY: "Uruguay",
  CH: "İsviçre",
  BE: "Belçika",
  SE: "İsveç",
  HR: "Hırvatistan",
  HU: "Macaristan",
  AT: "Avusturya",
  US: "ABD",
  NG: "Nijerya",
  RO: "Romanya",
  AU: "Avustralya",
  GH: "Gana",
  CZ: "Çekya",
  NO: "Norveç",
  CM: "Kamerun",
  SN: "Senegal",
  CI: "Fildişi Sahili",
};

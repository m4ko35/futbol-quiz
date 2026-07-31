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

/*
 * Ülke kodundan gösterilecek ad burada TUTULMAZ.
 *
 * Eskiden bu dosyada 30 kodluk elle yazılmış bir eşleme vardı. Oyuncu seçicisi
 * veri kümesindeki 170 kodun tamamını göstermek zorunda olduğu için ikinci bir
 * eşleme gerekiyordu ve aynı ülke iki ekranda iki farklı adla çıkabilirdi.
 * Tek kaynak artık `@/lib/country-name`; gerekçesi ve ölçümü orada.
 */
